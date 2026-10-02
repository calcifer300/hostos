-- HostOS — migration 0039: the scanner's heartbeat.
--
-- The extension sends a tiny heartbeat every minute ("still scanning, last read Turo at this time") on top of the
-- full snapshot, which is only sent when something changed. Without it a quiet hour looks like a dead scanner.

alter table command_snapshots add column if not exists scanner_seen_at timestamptz;
alter table command_snapshots add column if not exists last_scan_at timestamptz;
