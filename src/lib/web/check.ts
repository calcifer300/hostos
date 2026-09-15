import "server-only";
import tls from "node:tls";
import type { CheckOutcome } from "@/lib/web/queries";

/**
 * One check of one property: is the site answering, how fast, and when does
 * its certificate expire. Two probes — an HTTPS GET for status and timing, a
 * TLS handshake for the certificate — each with its own timeout, neither
 * allowed to throw. A site that redirects still counts as up; a site that
 * answers 5xx does not.
 */

const HTTP_TIMEOUT_MS = 12_000;
const TLS_TIMEOUT_MS = 8_000;

export function propertyUrl(domain: string, siteUrl: string | null): string {
  if (siteUrl && /^https?:\/\//i.test(siteUrl)) return siteUrl;
  return `https://${domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "")}`;
}

async function probeHttp(url: string): Promise<{ status: number | null; ms: number | null; error: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "HostOS-Monitor/1.0 (+https://hostoscollective.com)" },
      cache: "no-store",
    });
    return { status: res.status, ms: Date.now() - started, error: null };
  } catch (err) {
    const message = err instanceof Error ? (err.name === "AbortError" ? `No response within ${HTTP_TIMEOUT_MS / 1000}s` : err.message) : String(err);
    return { status: null, ms: null, error: message.slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}

function probeTls(host: string): Promise<{ expiresAt: string | null; issuer: string | null; error: string | null }> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: { expiresAt: string | null; issuer: string | null; error: string | null }) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    let socket: tls.TLSSocket | null = null;
    const timer = setTimeout(() => {
      socket?.destroy();
      done({ expiresAt: null, issuer: null, error: "TLS handshake timed out" });
    }, TLS_TIMEOUT_MS);
    try {
      socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false }, () => {
        const cert = socket?.getPeerCertificate();
        clearTimeout(timer);
        const validTo = cert?.valid_to ? new Date(cert.valid_to) : null;
        const issuer = cert?.issuer ? [cert.issuer.O, cert.issuer.CN].filter(Boolean).join(" · ") || null : null;
        socket?.end();
        done({ expiresAt: validTo && !Number.isNaN(validTo.getTime()) ? validTo.toISOString() : null, issuer, error: null });
      });
      socket.on("error", (err) => {
        clearTimeout(timer);
        done({ expiresAt: null, issuer: null, error: err.message.slice(0, 300) });
      });
    } catch (err) {
      clearTimeout(timer);
      done({ expiresAt: null, issuer: null, error: err instanceof Error ? err.message : String(err) });
    }
  });
}

export async function checkProperty(domain: string, siteUrl: string | null): Promise<CheckOutcome> {
  const url = propertyUrl(domain, siteUrl);
  const host = new URL(url).hostname;
  const [http, cert] = await Promise.all([probeHttp(url), probeTls(host)]);

  const up = http.status !== null && http.status < 500;
  const errors = [http.error, cert.error].filter(Boolean);
  return {
    status: http.status === null ? "down" : up ? "up" : "down",
    httpStatus: http.status,
    responseMs: http.ms,
    sslExpiresAt: cert.expiresAt,
    sslIssuer: cert.issuer,
    error: errors.length > 0 ? errors.join(" · ").slice(0, 500) : null,
  };
}
