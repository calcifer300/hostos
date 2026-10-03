document.addEventListener("DOMContentLoaded", () => {

    const scanButton = document.getElementById("scanButton");
    const status = document.getElementById("status");
    const output = document.getElementById("output");
    const tripsViewBtn = document.getElementById("tripsViewBtn");
    const fleetViewBtn = document.getElementById("fleetViewBtn");
    const boardViewBtn = document.getElementById("boardViewBtn");
    const syncViewBtn = document.getElementById("syncViewBtn");
    const alertsViewBtn = document.getElementById("alertsViewBtn");
    const repliesViewBtn = document.getElementById("repliesViewBtn");

    let lastRawTrips = null; // cached so "Add to Fleet" can re-render without rescanning
    let lastGenerated = null; // cached generateCards() output

    // Load any vehicles the VA has already added, so they're matched even
    // before the first scan of this session. Also load the log of guests
    // already messaged, used only for read-only status display now (see
    // renderLicenseCard) — sending is no longer done from this popup.
    loadCustomFleet();
    loadMessageLog();

    tripsViewBtn.addEventListener("click", () => showTripsView());
    fleetViewBtn.addEventListener("click", () => showFleetView());
    boardViewBtn.addEventListener("click", () => showActivityView());
    syncViewBtn.addEventListener("click", () => showSyncView());
    alertsViewBtn.addEventListener("click", () => showAlertsView());
    repliesViewBtn.addEventListener("click", () => showRepliesView());

    function setActiveViewBtn(activeBtn) {
        [tripsViewBtn, fleetViewBtn, boardViewBtn, syncViewBtn, alertsViewBtn, repliesViewBtn].forEach(btn => {
            btn.classList.toggle("active", btn === activeBtn);
        });
    }

    function showTripsView() {
        setActiveViewBtn(tripsViewBtn);
        scanButton.style.display = "";
        status.style.display = "";
        if (lastRawTrips) {
            renderAll(lastRawTrips);
        } else {
            output.innerHTML = `<div class="empty">Click "Sync HostOS" to scan the page.</div>`;
        }
    }

    async function showFleetView() {
        setActiveViewBtn(fleetViewBtn);
        scanButton.style.display = "none";
        status.style.display = "none";
        await loadCustomFleet();
        renderFleetManagerView();
    }

    async function showActivityView() {
        setActiveViewBtn(boardViewBtn);
        scanButton.style.display = "none";
        status.style.display = "none";
        await renderActivityView();
    }

    async function showAlertsView() {
        setActiveViewBtn(alertsViewBtn);
        scanButton.style.display = "none";
        status.style.display = "none";
        await renderAlertsView();
    }

    async function showRepliesView() {
        setActiveViewBtn(repliesViewBtn);
        scanButton.style.display = "none";
        status.style.display = "none";
        await renderRepliesView();
    }

    async function showSyncView() {
        setActiveViewBtn(syncViewBtn);
        scanButton.style.display = "none";
        status.style.display = "none";
        await renderSyncView();
    }

    scanButton.addEventListener("click", async () => {

        status.textContent = "Scanning Turo page...";
        output.innerHTML = "";
        scanButton.disabled = true;

        // Guards against the message callback never firing at all — e.g.
        // the Turo tab still has a stale content-script instance from
        // before the extension was last reloaded, which can silently never
        // respond instead of raising chrome.runtime.lastError. Without
        // this, the button would just sit disabled and the status text
        // would say "Scanning..." forever with no way to tell what happened.
        let settled = false;
        const timeoutId = setTimeout(() => {
            if (settled) return;
            settled = true;
            scanButton.disabled = false;
            status.textContent = "";
            output.innerHTML = `<div class="empty">Timed out waiting for a response from the page.<br>Try refreshing the Turo tab (a full page reload, not just re-focusing it) — this is usually needed once after installing or updating the extension — then click "Generate Trips" again.</div>`;
        }, 10000);

        try {
            await loadCustomFleet();

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            chrome.tabs.sendMessage(
                tab.id,
                { action: "scanTrips" },
                async (rawTrips) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeoutId);
                    scanButton.disabled = false;

                    if (chrome.runtime.lastError) {
                        status.textContent = "";
                        output.innerHTML = `<div class="empty">Error: ${chrome.runtime.lastError.message}<br>Make sure you're on a Turo trips page and reload the page after installing/updating the extension.</div>`;
                        return;
                    }

                    if (!rawTrips || rawTrips.length === 0) {
                        status.textContent = "";
                        output.innerHTML = `<div class="empty">No trip cards found on this page.</div>`;
                        return;
                    }

                    lastRawTrips = rawTrips;

                    try {
                        renderAll(rawTrips);
                    } catch (renderErr) {
                        console.error("Failed to render generated cards:", renderErr);
                        status.textContent = "";
                        output.innerHTML = `<div class="empty">Error while generating cards: ${escapeHtml(renderErr.message)}<br>Check the extension's console (right-click the panel \u2192 Inspect) for details.</div>`;
                        return;
                    }

                    // Push the same scan to HostOS. This is the button's
                    // namesake behavior \u2014 local rendering above always
                    // succeeds regardless of pairing status; this part is
                    // best-effort on top of it.
                    //
                    // This is the one button hosts actually click (the
                    // other "Sync Now" controls elsewhere in this file see
                    // far less use) \u2014 it used to stop at performSync(),
                    // which only ever syncs trips/vehicles. Real guest
                    // conversations only come from performSyncInbox()
                    // (turo.com/us/en/inbox/messages, with real timestamps)
                    // and canned reservation-panel text from
                    // performSyncMessages() \u2014 neither ran from here, so no
                    // host clicking just this button ever got real
                    // conversations into HostOS no matter how many times
                    // they synced.
                    const baseStatus = status.textContent;
                    const result = await performSync();
                    if (result.ok) {
                        status.textContent = `${baseStatus} \u2014 synced ${result.tripsProcessed} trip(s) to HostOS. Syncing messages\u2026`;
                    } else if (result.error && !/not connected/i.test(result.error)) {
                        status.textContent = `${baseStatus} \u2014 HostOS sync failed: ${result.error}`;
                        return;
                    }

                    const messageResult = await performSyncMessages();
                    const inboxResult = await performSyncInbox();
                    const totalMessages =
                        (messageResult.ok ? messageResult.messagesFound || 0 : 0) +
                        (inboxResult.ok ? inboxResult.messagesFound || 0 : 0);
                    const parts = [`synced ${result.tripsProcessed} trip(s)`];
                    parts.push(`${totalMessages} message(s)`);
                    if (!inboxResult.ok && inboxResult.error) parts.push(`inbox sync failed: ${inboxResult.error}`);
                    status.textContent = `${baseStatus} \u2014 ${parts.join(", ")}.`;
                }
            );
        } catch (err) {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            scanButton.disabled = false;
            status.textContent = "";
            output.innerHTML = `<div class="empty">Error: ${err.message}</div>`;
        }
    });

    function renderAll(rawTrips) {
        const generated = generateCards(rawTrips);
        lastGenerated = generated;
        const { todayStr, tomorrowStr, checkins, checkouts, skipped, unmatched, available, extrasRequested, upcomingForLicenseCheck } = generated;

        status.textContent = `Today: ${todayStr} (PT) — ${checkins.length} check-in(s), ${checkouts.length} check-out(s)${unmatched.length ? `, ${unmatched.length} need review` : ""}`;

        output.innerHTML = "";
        output.appendChild(renderAvailable(available, todayStr));
        if (upcomingForLicenseCheck.length > 0) {
            output.appendChild(renderLicenseCheck(upcomingForLicenseCheck));
        }
        if (extrasRequested.length > 0) {
            output.appendChild(renderExtrasRequested(extrasRequested));
        }
        output.appendChild(renderSection("Check-Ins", checkins, "checkin"));
        output.appendChild(renderSection("Check-Outs", checkouts, "checkout"));
        if (unmatched.length > 0) {
            output.appendChild(renderSection("Needs Review", unmatched, "unmatched"));
        }
        if (skipped.length > 0) {
            output.appendChild(renderSkipped(skipped));
        }
    }

    // Every trip that has a requested extra (child seat, pet fee, etc.),
    // regardless of whether it's a checkin, checkout, or already in
    // progress — so an in-progress trip with a child seat request doesn't
    // get missed just because it has nothing else actionable today.
    function renderExtrasRequested(entries) {
        const section = document.createElement("div");
        section.className = "section";

        const header = document.createElement("div");
        header.className = "section-header";

        const h2 = document.createElement("h2");
        h2.textContent = `Extras Requested (${entries.length})`;
        header.appendChild(h2);

        const headerBtns = document.createElement("div");
        headerBtns.style.display = "flex";
        headerBtns.style.gap = "6px";

        const fetchQtyBtn = document.createElement("button");
        fetchQtyBtn.textContent = "Fetch Quantities";
        headerBtns.appendChild(fetchQtyBtn);

        const copyAllBtn = document.createElement("button");
        copyAllBtn.textContent = "Copy All";
        copyAllBtn.addEventListener("click", () => {
            const allText = entries
                .map(e => formatExtraSummaryLine(e.parsed, e.fleet, e.dateStr))
                .join("\n");
            copyToClipboard(allText, copyAllBtn);
        });
        headerBtns.appendChild(copyAllBtn);

        header.appendChild(headerBtns);
        section.appendChild(header);

        const list = document.createElement("div");
        list.className = "card-list";

        // entry.id -> { card, chipsEl } so we can update a single card
        // in place as its quantity comes back, instead of re-rendering
        // the whole section and losing scroll position mid-fetch.
        const cardRefs = new Map();

        entries.forEach(entry => {
            const { card, chipsEl } = renderExtraCard(entry);
            cardRefs.set(entry.id, { entry, chipsEl });
            list.appendChild(card);
        });

        section.appendChild(list);

        fetchQtyBtn.addEventListener("click", () => {
            fetchQuantitiesForEntries(entries, cardRefs, fetchQtyBtn);
        });

        return section;
    }

    // Opens each reservation's detail page in a background tab, one at a
    // time, scrapes the real quantity for its extras, updates that card's
    // chips in place, then closes the tab and moves to the next — with a
    // short randomized delay between each so it doesn't fire off a burst
    // of near-simultaneous requests.
    async function fetchQuantitiesForEntries(entries, cardRefs, triggerBtn) {
        const withReservation = entries.filter(e => e.parsed.reservation);
        const skippedCount = entries.length - withReservation.length;

        triggerBtn.disabled = true;
        const originalLabel = triggerBtn.textContent;

        for (let i = 0; i < withReservation.length; i++) {
            const entry = withReservation[i];
            triggerBtn.textContent = `Fetching ${i + 1}/${withReservation.length}...`;

            try {
                const url = `https://turo.com/us/en/reservation/${entry.parsed.reservation}`;
                const tab = await chrome.tabs.create({ url, active: false });

                await waitForTabComplete(tab.id, 12000);
                // Give the page's own scripts a moment to finish rendering
                // after "complete" fires, since Turo's detail page loads
                // some content client-side after initial paint.
                await delay(1200 + Math.floor(Math.random() * 500));

                const response = await sendMessageToTabSafe(tab.id, { action: "scanReservationExtras" });

                if (response && Array.isArray(response.extras)) {
                    mergeExtraQuantities(entry.parsed.extras, response.extras);
                    const ref = cardRefs.get(entry.id);
                    if (ref) updateExtraChips(ref.chipsEl, entry.parsed.extras);
                }

                await chrome.tabs.remove(tab.id);
            } catch (err) {
                console.error("Failed to fetch quantity for reservation", entry.parsed.reservation, err);
            }

            await delay(700 + Math.floor(Math.random() * 500));
        }

        triggerBtn.textContent = originalLabel;
        triggerBtn.disabled = false;

        if (skippedCount > 0) {
            status.textContent = `Fetched quantities where possible — ${skippedCount} trip(s) had no reservation # to look up.`;
        }
    }

    function waitForTabComplete(tabId, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                reject(new Error("Timed out waiting for tab to load"));
            }, timeoutMs);

            function listener(updatedTabId, changeInfo) {
                if (updatedTabId === tabId && changeInfo.status === "complete") {
                    clearTimeout(timer);
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            }

            chrome.tabs.onUpdated.addListener(listener);
        });
    }

    function sendMessageToTabSafe(tabId, message) {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                if (chrome.runtime.lastError) {
                    resolve(null);
                    return;
                }
                resolve(response);
            });
        });
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Updates quantities in-place on an existing extras array by label
    // match (case-insensitive) — leaves the label untouched, only fills
    // in the real quantity scraped from the detail page.
    function mergeExtraQuantities(existingExtras, fetchedExtras) {
        (existingExtras || []).forEach(existing => {
            const match = fetchedExtras.find(f => f.label.toLowerCase() === existing.label.toLowerCase());
            if (match) existing.quantity = match.quantity;
        });
    }

    function updateExtraChips(chipsEl, extras) {
        chipsEl.innerHTML = "";
        extras.forEach(extra => {
            const chip = document.createElement("span");
            chip.className = "task-chip extra-chip";
            chip.textContent = extra.quantity > 1 ? `${extra.label} x${extra.quantity}` : `${extra.label} \u2713`;
            chip.title = "Quantity confirmed from reservation detail page";
            chipsEl.appendChild(chip);
        });
    }

    function renderExtraCard(entry) {
        const card = document.createElement("div");
        card.className = "card extras";

        const body = document.createElement("div");
        body.className = "card-body";

        const dateEl = document.createElement("div");
        dateEl.className = "card-date";
        const actionLabel = entry.action === "checkin" ? "Starting"
            : entry.action === "checkout" ? "Ending"
            : (entry.parsed.skipReason || "In progress");
        dateEl.textContent = `${entry.dateStr} \u2014 ${actionLabel}${entry.parsed.time ? " at " + entry.parsed.time : ""}`;
        body.appendChild(dateEl);

        const vehicleEl = document.createElement("div");
        vehicleEl.className = "vehicle-line";
        vehicleEl.textContent = entry.fleet
            ? `${entry.fleet.color} ${entry.fleet.make} ${entry.fleet.model} ${entry.fleet.year}`
            : [entry.parsed.vehicleMake, entry.parsed.vehicleModel, entry.parsed.vehicleYear].filter(Boolean).join(" ") || "Unknown vehicle";
        body.appendChild(vehicleEl);

        const plateEl = document.createElement("div");
        plateEl.className = "plate-badge";
        plateEl.innerHTML = `<span>${escapeHtml(entry.parsed.plate || "UNKNOWN")}</span>${entry.fleet && entry.fleet.lockbox ? `<span class="lockbox">Lockbox ${escapeHtml(entry.fleet.lockbox)}</span>` : ""}`;
        body.appendChild(plateEl);

        if (entry.parsed.guest) {
            const guestEl = document.createElement("div");
            guestEl.className = "action-line";
            guestEl.textContent = `${entry.parsed.guest}${entry.parsed.reservation ? " #" + entry.parsed.reservation : ""}`;
            body.appendChild(guestEl);
        }

        const chipsEl = document.createElement("div");
        chipsEl.className = "task-chips";
        entry.parsed.extras.forEach(extra => {
            const chip = document.createElement("span");
            chip.className = "task-chip extra-chip";
            chip.textContent = extra.quantity > 1 ? `${extra.label} x${extra.quantity}` : extra.label;
            chipsEl.appendChild(chip);
        });
        body.appendChild(chipsEl);

        if (!entry.parsed.reservation) {
            const note = document.createElement("div");
            note.className = "action-line";
            note.style.opacity = "0.7";
            note.textContent = "No reservation # detected \u2014 can't look up quantity.";
            body.appendChild(note);
        }

        card.appendChild(body);

        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.textContent = "Copy";
        copyBtn.addEventListener("click", () => {
            copyToClipboard(formatExtraSummaryLine(entry.parsed, entry.fleet, entry.dateStr), copyBtn);
        });
        card.appendChild(copyBtn);

        return { card, chipsEl };
    }

    // Vehicles with no booking covering today or tomorrow (see availability.js).
    // Each card is editable (color/make/model/year/lockbox) and copies as a
    // single Trello-style line matching the real board's convention, e.g.
    // "7/8: Dark Gray Audi Q5 2014 9MCH670 6790 NO TRIP - NEW PHOTOS".
    // Edits are saved to the custom fleet store so lockbox codes you fill
    // in are remembered next scan.
    function renderAvailable(entries, todayStr) {
        const section = document.createElement("div");
        section.className = "section";

        const header = document.createElement("div");
        header.className = "section-header";

        const h2 = document.createElement("h2");
        h2.textContent = `Available Today & Tomorrow (${entries.length})`;
        header.appendChild(h2);

        const list = document.createElement("div");
        list.className = "card-list";

        if (entries.length > 0) {
            const copyAllBtn = document.createElement("button");
            copyAllBtn.textContent = "Copy All";
            copyAllBtn.addEventListener("click", () => {
                const cards = Array.from(list.querySelectorAll(".available-card"));
                const allText = cards
                    .map(card => buildAvailableCardText(card, todayStr))
                    .join("\n");
                copyToClipboard(allText, copyAllBtn);
            });
            header.appendChild(copyAllBtn);
        }

        section.appendChild(header);

        if (entries.length === 0) {
            const empty = document.createElement("div");
            empty.className = "empty";
            empty.textContent = "Nothing's idle — every vehicle has a booking today or tomorrow.";
            list.appendChild(empty);
        } else {
            entries.forEach(entry => {
                list.appendChild(renderAvailableCard(entry, todayStr));
            });
        }

        section.appendChild(list);
        return section;
    }

    function renderAvailableCard(entry, todayStr) {
        const card = document.createElement("div");
        card.className = "card available available-card";
        card.dataset.availableToday = entry.availableToday ? "1" : "0";
        card.dataset.availableTomorrow = entry.availableTomorrow ? "1" : "0";

        const body = document.createElement("div");
        body.className = "card-body";

        const statusEl = document.createElement("div");
        statusEl.className = "availability-tag";
        if (entry.availableToday && entry.availableTomorrow) {
            statusEl.textContent = "Free today & tomorrow";
        } else if (entry.availableToday) {
            statusEl.textContent = "Free today \u2014 booked for tomorrow";
            statusEl.classList.add("partial");
        } else {
            statusEl.textContent = "Booked today \u2014 free tomorrow";
            statusEl.classList.add("partial");
        }
        body.appendChild(statusEl);

        const fieldsRow = document.createElement("div");
        fieldsRow.className = "available-fields";

        const colorInput = makeInlineInput("f-color", entry.color, "Color");
        const makeInput = makeInlineInput("f-make", entry.make, "Make");
        const modelInput = makeInlineInput("f-model", entry.model, "Model");
        const yearInput = makeInlineInput("f-year", entry.year, "Year");

        fieldsRow.appendChild(colorInput);
        fieldsRow.appendChild(makeInput);
        fieldsRow.appendChild(modelInput);
        fieldsRow.appendChild(yearInput);
        body.appendChild(fieldsRow);

        const plateRow = document.createElement("div");
        plateRow.className = "plate-badge editable-plate-badge";

        const plateSpan = document.createElement("span");
        plateSpan.textContent = entry.plate;
        plateRow.appendChild(plateSpan);

        const lockboxInput = makeInlineInput("f-lockbox", entry.lockbox, "Lockbox");
        lockboxInput.classList.add("lockbox-input");
        plateRow.appendChild(lockboxInput);

        body.appendChild(plateRow);

        // Live preview of the exact single line that gets copied — matches
        // the real Trello card text convention, so you can eyeball it
        // before pasting.
        const preview = document.createElement("div");
        preview.className = "available-preview";
        body.appendChild(preview);

        card.appendChild(body);

        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.textContent = "Copy";
        copyBtn.addEventListener("click", () => {
            copyToClipboard(buildAvailableCardText(card, todayStr), copyBtn);
        });
        card.appendChild(copyBtn);

        const inputs = [colorInput, makeInput, modelInput, yearInput, lockboxInput];

        function updatePreview() {
            preview.textContent = buildAvailableCardText(card, todayStr);
        }

        inputs.forEach(input => {
            input.addEventListener("input", updatePreview);
            // Persist edits (e.g. a newly-filled-in lockbox code) so they're
            // remembered on the next scan too.
            input.addEventListener("blur", () => saveEditedVehicle(card, entry.plate));
        });

        updatePreview();

        return card;
    }

    function makeInlineInput(cls, value, placeholder) {
        const input = document.createElement("input");
        input.type = "text";
        input.className = `inline-edit ${cls}`;
        input.value = value || "";
        input.placeholder = placeholder;
        return input;
    }

    function readAvailableCardFields(card) {
        return {
            color: card.querySelector(".f-color").value.trim(),
            make: card.querySelector(".f-make").value.trim(),
            model: card.querySelector(".f-model").value.trim(),
            year: card.querySelector(".f-year").value.trim(),
            plate: card.querySelector(".plate-badge span").textContent.trim(),
            lockbox: card.querySelector(".f-lockbox").value.trim(),
            availableToday: card.dataset.availableToday === "1",
            availableTomorrow: card.dataset.availableTomorrow === "1"
        };
    }

    function buildAvailableCardText(card, todayStr) {
        return formatAvailableCard(readAvailableCardFields(card), todayStr);
    }

    async function saveEditedVehicle(card, plate) {
        const fields = readAvailableCardFields(card);
        const existing = (typeof matchFleet === "function" && matchFleet(plate)) || {};
        await saveCustomFleetEntry(plate, {
            color: fields.color,
            make: fields.make,
            model: fields.model,
            year: fields.year,
            lockbox: fields.lockbox,
            permit: existing.permit || ""
        });
    }

    function renderSection(title, entries, kind) {
        const section = document.createElement("div");
        section.className = "section";

        const header = document.createElement("div");
        header.className = "section-header";

        const h2 = document.createElement("h2");
        h2.textContent = `${title} (${entries.length})`;
        header.appendChild(h2);

        if (entries.length > 0 && kind !== "unmatched") {
            const copyAllBtn = document.createElement("button");
            copyAllBtn.textContent = "Copy All";
            copyAllBtn.addEventListener("click", () => {
                const allText = entries.map(e => e.cardText).join("\n\n---\n\n");
                copyToClipboard(allText, copyAllBtn);
            });
            header.appendChild(copyAllBtn);
        }

        section.appendChild(header);

        const list = document.createElement("div");
        list.className = "card-list";

        if (entries.length === 0) {
            const empty = document.createElement("div");
            empty.className = "empty";
            empty.textContent = "Nothing here.";
            list.appendChild(empty);
        } else {
            entries.forEach(entry => {
                list.appendChild(kind === "unmatched" ? renderUnmatchedCard(entry) : renderCard(entry, kind));
            });
        }

        section.appendChild(list);
        return section;
    }

    function renderCard(entry, kind) {
        const card = document.createElement("div");
        card.className = `card ${kind}`;

        const body = document.createElement("div");
        body.className = "card-body";

        const dateEl = document.createElement("div");
        dateEl.className = "card-date";
        dateEl.textContent = entry.dateStr;
        body.appendChild(dateEl);

        const vehicleEl = document.createElement("div");
        vehicleEl.className = "vehicle-line";
        vehicleEl.textContent = `${entry.fleet.color} ${entry.fleet.make} ${entry.fleet.model} ${entry.fleet.year}`;
        body.appendChild(vehicleEl);

        const plateEl = document.createElement("div");
        plateEl.className = "plate-badge";
        plateEl.innerHTML = `<span>${escapeHtml(entry.parsed.plate)}</span>${entry.fleet.lockbox ? `<span class="lockbox">Lockbox ${escapeHtml(entry.fleet.lockbox)}</span>` : ""}`;
        body.appendChild(plateEl);

        const actionEl = document.createElement("div");
        actionEl.className = "action-line";
        const actionLabel = kind === "checkin" ? "Starting" : "Ending";
        actionEl.innerHTML = `<span class="action-dot"></span><span>${actionLabel} at ${escapeHtml(entry.parsed.time || "?")}</span>`;
        body.appendChild(actionEl);

        const chipsEl = document.createElement("div");
        chipsEl.className = "task-chips";
        const tasks = kind === "checkin" ? ["New photos"] : ["Check out", "Wash", "Photos"];
        tasks.forEach(t => {
            const chip = document.createElement("span");
            chip.className = "task-chip";
            chip.textContent = t;
            chipsEl.appendChild(chip);
        });
        (entry.parsed.extras || []).forEach(extra => {
            const chip = document.createElement("span");
            chip.className = "task-chip extra-chip";
            chip.textContent = extra.quantity > 1 ? `${extra.label} x${extra.quantity}` : extra.label;
            chipsEl.appendChild(chip);
        });
        body.appendChild(chipsEl);

        card.appendChild(body);

        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.textContent = "Copy";
        copyBtn.addEventListener("click", () => copyToClipboard(entry.cardText, copyBtn));
        card.appendChild(copyBtn);

        return card;
    }

    function renderUnmatchedCard(entry) {
        const wrapper = document.createElement("div");
        wrapper.className = "unmatched-wrapper";

        const card = document.createElement("div");
        card.className = "card unmatched";

        const pre = document.createElement("pre");
        pre.textContent = entry.cardText;
        card.appendChild(pre);

        const btnGroup = document.createElement("div");
        btnGroup.className = "unmatched-btn-group";

        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.textContent = "Copy";
        copyBtn.addEventListener("click", () => copyToClipboard(entry.cardText, copyBtn));
        btnGroup.appendChild(copyBtn);

        const addBtn = document.createElement("button");
        addBtn.className = "copy-btn add-fleet-btn";
        addBtn.textContent = "Add to Fleet";
        btnGroup.appendChild(addBtn);

        card.appendChild(btnGroup);
        wrapper.appendChild(card);

        const form = buildAddToFleetForm(entry, () => form.remove(), () => {
            addBtn.style.display = "none";
        });
        form.style.display = "none";
        wrapper.appendChild(form);

        addBtn.addEventListener("click", () => {
            form.style.display = form.style.display === "none" ? "block" : "none";
        });

        return wrapper;
    }

    function buildAddToFleetForm(entry, onCancel, onSaved) {
        const form = document.createElement("div");
        form.className = "add-fleet-form";

        const plate = entry.parsed.plate || "";

        form.innerHTML = `
            <div class="form-title">Add ${escapeHtml(plate || "vehicle")} to fleet</div>
            <div class="form-row">
                <label>Color</label>
                <input type="text" class="f-color" placeholder="e.g. White">
            </div>
            <div class="form-row">
                <label>Make</label>
                <input type="text" class="f-make" placeholder="e.g. Volkswagen">
            </div>
            <div class="form-row">
                <label>Model</label>
                <input type="text" class="f-model" placeholder="e.g. Passat">
            </div>
            <div class="form-row">
                <label>Year</label>
                <input type="text" class="f-year" placeholder="e.g. 2012">
            </div>
            <div class="form-row">
                <label>Lockbox</label>
                <input type="text" class="f-lockbox" placeholder="e.g. 1479">
            </div>
            <div class="form-row">
                <label>Permit</label>
                <input type="text" class="f-permit" placeholder="optional">
            </div>
            <div class="form-actions">
                <button class="form-cancel">Cancel</button>
                <button class="form-save">Save vehicle</button>
            </div>
        `;

        // Prefill make/model/year if the parser spotted them on the card.
        form.querySelector(".f-make").value = entry.parsed.vehicleMake || "";
        form.querySelector(".f-model").value = entry.parsed.vehicleModel || "";
        form.querySelector(".f-year").value = entry.parsed.vehicleYear || "";

        form.querySelector(".form-cancel").addEventListener("click", () => {
            form.style.display = "none";
        });

        form.querySelector(".form-save").addEventListener("click", async () => {
            if (!plate) {
                alert("No plate detected on this card — can't save.");
                return;
            }

            const fleetEntry = {
                color: form.querySelector(".f-color").value.trim(),
                make: form.querySelector(".f-make").value.trim(),
                model: form.querySelector(".f-model").value.trim(),
                year: form.querySelector(".f-year").value.trim(),
                lockbox: form.querySelector(".f-lockbox").value.trim(),
                permit: form.querySelector(".f-permit").value.trim()
            };

            const saveBtn = form.querySelector(".form-save");
            saveBtn.textContent = "Saving...";
            saveBtn.disabled = true;

            await saveCustomFleetEntry(plate, fleetEntry);

            // Re-render everything using the trips already scanned, now that
            // this plate will resolve.
            if (lastRawTrips) {
                renderAll(lastRawTrips);
            }
        });

        return form;
    }

    // ---------- Fleet manager (add/edit/remove, independent of today's trips) ----------

    function renderFleetManagerView() {
        output.innerHTML = "";

        const wrapper = document.createElement("div");
        wrapper.className = "section";

        const toolbar = document.createElement("div");
        toolbar.className = "fleet-toolbar";

        const search = document.createElement("input");
        search.type = "text";
        search.className = "fleet-search";
        search.placeholder = "Search plate, make, model...";
        toolbar.appendChild(search);

        const addBtn = document.createElement("button");
        addBtn.className = "fleet-add-btn";
        addBtn.textContent = "+ Add Vehicle";
        toolbar.appendChild(addBtn);

        wrapper.appendChild(toolbar);

        const newForm = buildNewVehicleForm(() => renderFleetManagerView());
        newForm.style.display = "none";
        wrapper.appendChild(newForm);

        addBtn.addEventListener("click", () => {
            newForm.style.display = newForm.style.display === "none" ? "block" : "none";
        });

        const list = document.createElement("div");
        list.className = "card-list";
        list.style.maxHeight = "none";

        const entries = getAllFleetEntriesIncludingRemoved()
            .sort((a, b) => a.plate.localeCompare(b.plate));

        if (entries.length === 0) {
            const empty = document.createElement("div");
            empty.className = "fleet-empty";
            empty.textContent = "No vehicles yet. Add one above.";
            list.appendChild(empty);
        } else {
            entries.forEach(entry => {
                list.appendChild(renderFleetCard(entry));
            });
        }

        wrapper.appendChild(list);
        output.appendChild(wrapper);

        // Client-side filter — doesn't touch data, so it can't race with saves.
        search.addEventListener("input", () => {
            const q = search.value.trim().toLowerCase();
            Array.from(list.querySelectorAll(".fleet-card")).forEach(card => {
                const haystack = card.dataset.search || "";
                card.style.display = !q || haystack.includes(q) ? "" : "none";
            });
        });
    }

    function renderFleetCard(entry) {
        const card = document.createElement("div");
        card.dataset.search = `${entry.plate} ${entry.make || ""} ${entry.model || ""} ${entry.color || ""}`.toLowerCase();

        const { isBuiltIn, isCustom } = getFleetSourceInfo(entry.plate);

        let sourceClass, badgeClass, badgeText;
        if (entry.removed) {
            sourceClass = "source-removed"; badgeClass = "removed"; badgeText = "Retired";
        } else if (isBuiltIn && isCustom) {
            sourceClass = "source-override"; badgeClass = "override"; badgeText = "Override";
        } else if (isCustom) {
            sourceClass = "source-custom"; badgeClass = "custom"; badgeText = "Custom";
        } else {
            sourceClass = "source-builtin"; badgeClass = ""; badgeText = "Built-in";
        }

        card.className = `fleet-card ${sourceClass}`;

        const top = document.createElement("div");
        top.className = "fleet-card-top";

        const badge = document.createElement("span");
        badge.className = `source-badge ${badgeClass}`;
        badge.textContent = badgeText;
        top.appendChild(badge);

        const actions = document.createElement("div");
        actions.className = "fleet-card-actions";

        if (entry.removed) {
            const restoreBtn = document.createElement("button");
            restoreBtn.className = "fleet-action-btn reset";
            restoreBtn.textContent = "Restore";
            restoreBtn.addEventListener("click", async () => {
                await restoreFleetVehicle(entry.plate);
                renderFleetManagerView();
            });
            actions.appendChild(restoreBtn);
        } else {
            if (isBuiltIn && isCustom) {
                const resetBtn = document.createElement("button");
                resetBtn.className = "fleet-action-btn reset";
                resetBtn.textContent = "Reset to Original";
                resetBtn.addEventListener("click", async () => {
                    await deleteCustomFleetEntry(entry.plate);
                    renderFleetManagerView();
                });
                actions.appendChild(resetBtn);
            }

            const removeBtn = document.createElement("button");
            removeBtn.className = "fleet-action-btn danger";
            removeBtn.textContent = isBuiltIn ? "Retire" : "Remove";
            removeBtn.addEventListener("click", async () => {
                const label = isBuiltIn ? "retire" : "remove";
                if (!confirm(`Are you sure you want to ${label} ${entry.plate}?`)) return;
                await removeFleetVehicle(entry.plate);
                renderFleetManagerView();
            });
            actions.appendChild(removeBtn);
        }

        top.appendChild(actions);
        card.appendChild(top);

        const fieldsRow = document.createElement("div");
        fieldsRow.className = "fleet-fields";

        const colorInput = makeInlineInput("f-color", entry.color, "Color");
        const makeInput = makeInlineInput("f-make", entry.make, "Make");
        const modelInput = makeInlineInput("f-model", entry.model, "Model");
        const yearInput = makeInlineInput("f-year", entry.year, "Year");
        [colorInput, makeInput, modelInput, yearInput].forEach(i => { i.disabled = entry.removed; });

        fieldsRow.appendChild(colorInput);
        fieldsRow.appendChild(makeInput);
        fieldsRow.appendChild(modelInput);
        fieldsRow.appendChild(yearInput);
        card.appendChild(fieldsRow);

        const plateRow = document.createElement("div");
        plateRow.className = "fleet-plate-row";

        const plateStatic = document.createElement("span");
        plateStatic.className = "fleet-plate-static";
        plateStatic.textContent = entry.plate;
        plateRow.appendChild(plateStatic);

        const lockboxInput = document.createElement("input");
        lockboxInput.type = "text";
        lockboxInput.className = "lockbox-input";
        lockboxInput.placeholder = "Lockbox";
        lockboxInput.value = entry.lockbox || "";
        lockboxInput.disabled = entry.removed;
        plateRow.appendChild(lockboxInput);

        const permitInput = document.createElement("input");
        permitInput.type = "text";
        permitInput.className = "permit-input";
        permitInput.placeholder = "Permit";
        permitInput.value = entry.permit || "";
        permitInput.disabled = entry.removed;
        plateRow.appendChild(permitInput);

        card.appendChild(plateRow);

        const allInputs = [colorInput, makeInput, modelInput, yearInput, lockboxInput, permitInput];
        allInputs.forEach(input => {
            input.addEventListener("blur", async () => {
                await saveCustomFleetEntry(entry.plate, {
                    color: colorInput.value.trim(),
                    make: makeInput.value.trim(),
                    model: modelInput.value.trim(),
                    year: yearInput.value.trim(),
                    lockbox: lockboxInput.value.trim(),
                    permit: permitInput.value.trim()
                });
                // Refresh the badge (built-in -> override) without losing focus/scroll
                // mid-typing — only the badge on THIS card needs to change.
                const { isBuiltIn: nowBuiltIn, isCustom: nowCustom } = getFleetSourceInfo(entry.plate);
                if (nowBuiltIn && nowCustom && badgeText !== "Override") {
                    renderFleetManagerView();
                }
            });
        });

        return card;
    }

    function buildNewVehicleForm(onSaved) {
        const form = document.createElement("div");
        form.className = "new-vehicle-form";

        form.innerHTML = `
            <div class="form-title">Add new vehicle</div>
            <div class="form-row">
                <label>Plate</label>
                <input type="text" class="f-plate" placeholder="e.g. 9MCH670">
            </div>
            <div class="form-row">
                <label>Color</label>
                <input type="text" class="f-color" placeholder="e.g. White">
            </div>
            <div class="form-row">
                <label>Make</label>
                <input type="text" class="f-make" placeholder="e.g. Volkswagen">
            </div>
            <div class="form-row">
                <label>Model</label>
                <input type="text" class="f-model" placeholder="e.g. Passat">
            </div>
            <div class="form-row">
                <label>Year</label>
                <input type="text" class="f-year" placeholder="e.g. 2012">
            </div>
            <div class="form-row">
                <label>Lockbox</label>
                <input type="text" class="f-lockbox" placeholder="e.g. 1479">
            </div>
            <div class="form-row">
                <label>Permit</label>
                <input type="text" class="f-permit" placeholder="optional">
            </div>
            <div class="form-actions">
                <button class="form-cancel">Cancel</button>
                <button class="form-save">Save vehicle</button>
            </div>
        `;

        form.querySelector(".form-cancel").addEventListener("click", () => {
            form.style.display = "none";
            form.querySelectorAll("input").forEach(i => { i.value = ""; });
        });

        form.querySelector(".form-save").addEventListener("click", async () => {
            const plateInput = form.querySelector(".f-plate");
            const plate = plateInput.value.trim().toUpperCase();

            if (!plate) {
                alert("Enter a plate number.");
                return;
            }

            const fleetEntry = {
                color: form.querySelector(".f-color").value.trim(),
                make: form.querySelector(".f-make").value.trim(),
                model: form.querySelector(".f-model").value.trim(),
                year: form.querySelector(".f-year").value.trim(),
                lockbox: form.querySelector(".f-lockbox").value.trim(),
                permit: form.querySelector(".f-permit").value.trim()
            };

            const saveBtn = form.querySelector(".form-save");
            saveBtn.textContent = "Saving...";
            saveBtn.disabled = true;

            await saveCustomFleetEntry(plate, fleetEntry);
            onSaved();
        });

        return form;
    }

    // ---------- Activity (last sync results) ----------

    function formatSyncTime(ts) {
        if (!ts) return "never";
        const diffMs = Date.now() - ts;
        const minutes = Math.round(diffMs / 60000);
        if (minutes < 1) return "just now";
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.round(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return new Date(ts).toLocaleString();
    }

    // Reads the result of the most recent sync (fired either by the
    // background alarm every minute, or manually) and shows what happened.
    // No Trello scanning here anymore — that reconciliation now lives in
    // HostOS itself, against the real synced data in Supabase.
    async function renderActivityView() {
        output.innerHTML = `<div class="empty">Loading...</div>`;
        const last = await loadLastSyncResult();
        const { url, apiKey } = await getHostOSConfig();

        output.innerHTML = "";

        const section = document.createElement("div");
        section.className = "section";

        const header = document.createElement("div");
        header.className = "section-header";
        const h2 = document.createElement("h2");
        h2.textContent = "Last sync";
        header.appendChild(h2);

        if (url && apiKey) {
            const syncNowBtn = document.createElement("button");
            syncNowBtn.textContent = "Sync Now";
            syncNowBtn.addEventListener("click", async () => {
                // A manual click means "sync everything now", not just
                // trips — otherwise this button did nothing for guest
                // messages/inbox, which is exactly why they looked stuck
                // even after repeated clicks. Trips first since the other
                // two read its output (loadLastSyncResult) to know which
                // reservations are worth opening.
                syncNowBtn.disabled = true;
                syncNowBtn.textContent = "Syncing trips...";
                await performSync();
                syncNowBtn.textContent = "Syncing messages...";
                await performSyncMessages();
                syncNowBtn.textContent = "Syncing inbox...";
                await performSyncInbox();
                await renderActivityView();
            });
            header.appendChild(syncNowBtn);
        }

        section.appendChild(header);

        const body = document.createElement("div");
        body.style.padding = "10px";

        if (!url || !apiKey) {
            body.innerHTML = `<div class="empty">Not connected yet. Open the Synchronization tab to pair with HostOS.</div>`;
            section.appendChild(body);
            output.appendChild(section);
            return;
        }

        if (!last) {
            body.innerHTML = `<div class="empty">No sync has run yet. It runs automatically every minute while this browser is open, or click "Sync Now" above.</div>`;
            section.appendChild(body);
            output.appendChild(section);
            return;
        }

        const summary = document.createElement("div");
        summary.style.marginBottom = "8px";
        summary.style.fontSize = "12px";
        summary.style.color = "var(--text-dim)";
        summary.textContent = `${formatSyncTime(last.at)} — ` + (
            last.ok
                ? `${last.tripsProcessed} trip(s) synced, ${last.eventsCreated} change(s) detected.`
                : `Failed: ${last.error}`
        );
        body.appendChild(summary);
        section.appendChild(body);

        if (last.ok && Array.isArray(last.events) && last.events.length > 0) {
            const list = document.createElement("div");
            list.className = "card-list";
            last.events.forEach(ev => {
                const card = document.createElement("div");
                card.className = "card unmatched";
                card.innerHTML = `<div class="card-body">
                    <div class="card-date">${escapeHtml(ev.kind || "change")}</div>
                    <div class="vehicle-line">${escapeHtml(ev.description || "")}</div>
                </div>`;
                list.appendChild(card);
            });
            section.appendChild(list);
        }

        output.appendChild(section);
    }

    // ---------- Alerts ----------
    //
    // Karl's scanner had a whole options page for this; the merged extension
    // shipped its engine (alerts.js) with no way to see or change any of it.
    // Notifications were firing that nobody could turn off, and a rule nobody
    // could inspect.

    async function renderAlertsView() {
        output.innerHTML = "";

        const { rules, settings } = await loadAlertConfig();
        const { alertBadge = 0 } = await chrome.storage.session.get("alertBadge");

        // --- master switch -------------------------------------------------
        const master = document.createElement("div");
        master.className = "panel";
        master.innerHTML = `
            <div class="panel-head">
                <h2>Desktop alerts</h2>
            </div>
            <div class="panel-note">
                Raised from what HostOS records on each sync, so an alert names the
                change rather than guessing it from page text.
            </div>`;

        const masterRow = document.createElement("div");
        masterRow.className = "row";
        masterRow.appendChild(makeSwitch(settings.enabled, async (on) => {
            settings.enabled = on;
            await saveAlertConfig(rules, settings);
            await renderAlertsView();
        }, "Desktop alerts"));
        const masterMain = document.createElement("div");
        masterMain.className = "row-main";
        masterMain.innerHTML = `<div class="row-title">${settings.enabled ? "On" : "Off"}</div>
            <div class="row-sub">${settings.enabled
                ? "You'll get a notification when something needs you."
                : "Nothing will interrupt you. The sync itself keeps running."}</div>`;
        masterRow.appendChild(masterMain);
        master.appendChild(masterRow);
        output.appendChild(master);

        if (!settings.enabled) return;

        // --- what to be told about ------------------------------------------
        const kinds = document.createElement("div");
        kinds.className = "panel";
        kinds.innerHTML = `<div class="panel-head"><h2>Tell me about</h2></div>`;

        [
            ["onNewMessage", "New guest messages", "A guest replied on a reservation."],
            ["onLicenceOverdue", "Unverified licenses", "Pickup is close and the license still isn't confirmed."],
            ["onPremierBooking", "Zero-deductible bookings", "Damage can't be billed to the guest on these."],
            ["onProfitRisk", "Trips below $0.20 a mile", "What you earn, divided by the miles included."],
        ].forEach(([key, title, sub]) => {
            const row = document.createElement("div");
            row.className = "row";
            row.appendChild(makeSwitch(settings[key] !== false, async (on) => {
                settings[key] = on;
                await saveAlertConfig(rules, settings);
            }, title));
            const main = document.createElement("div");
            main.className = "row-main";
            main.innerHTML = `<div class="row-title">${escapeHtml(title)}</div><div class="row-sub">${escapeHtml(sub)}</div>`;
            row.appendChild(main);
            kinds.appendChild(row);
        });
        output.appendChild(kinds);

        // --- keyword rules --------------------------------------------------
        const rulesPanel = document.createElement("div");
        rulesPanel.className = "panel";
        rulesPanel.innerHTML = `
            <div class="panel-head"><h2>Watch the open Turo tab</h2></div>
            <div class="panel-note">
                A booking request can appear on screen minutes before the next sync
                picks it up. These scan only the Turo tab you're looking at.
            </div>`;

        rules.forEach((rule) => {
            const row = document.createElement("div");
            row.className = "row";

            const dot = document.createElement("span");
            dot.className = `sev ${rule.severity || "medium"}`;
            row.appendChild(dot);

            const main = document.createElement("div");
            main.className = "row-main";
            main.innerHTML = `<div class="row-title">${escapeHtml(rule.name)}</div>
                <div class="row-sub">${escapeHtml((rule.keywords || []).join(", "))}</div>`;
            row.appendChild(main);

            row.appendChild(makeSwitch(rule.enabled !== false, async (on) => {
                rule.enabled = on;
                await saveAlertConfig(rules, settings);
            }, rule.name));

            rulesPanel.appendChild(row);
        });
        output.appendChild(rulesPanel);

        // --- housekeeping ---------------------------------------------------
        const foot = document.createElement("div");
        foot.className = "panel";
        const footRow = document.createElement("div");
        footRow.className = "row";
        const footMain = document.createElement("div");
        footMain.className = "row-main";
        footMain.innerHTML = `<div class="row-title">${alertBadge} unread</div>
            <div class="row-sub">Clears the count on the toolbar icon.</div>`;
        footRow.appendChild(footMain);

        const clear = document.createElement("button");
        clear.className = "mini-btn";
        clear.textContent = "Clear";
        clear.addEventListener("click", async () => {
            await clearBadge();
            await renderAlertsView();
        });
        footRow.appendChild(clear);

        const test = document.createElement("button");
        test.className = "mini-btn";
        test.textContent = "Test";
        test.addEventListener("click", async () => {
            // Deliberately unique per press: raiseAlert de-dupes on the key, so a
            // fixed one would fire once and then look broken.
            await raiseAlert({
                key: "test:" + Date.now(),
                title: "hostOS Companion",
                body: "Desktop alerts are working.",
                severity: "medium",
            });
            test.textContent = "Sent";
            setTimeout(() => { test.textContent = "Test"; }, 1500);
        });
        footRow.appendChild(test);

        foot.appendChild(footRow);
        output.appendChild(foot);
    }

    // ---------- Saved replies ----------
    //
    // Karl's ai-reply extension let a host store an answer against a trigger
    // phrase, so a question asked forty times a week is answered without a
    // model call. replyMatcher.js came across with the merge and had nothing
    // calling it — this is the surface that fills it, and assist.js checks it
    // before asking HostOS to draft.

    const SAVED_REPLIES_KEY = "hostosSavedReplies";

    function loadSavedReplies() {
        return new Promise((resolve) => {
            chrome.storage.local.get([SAVED_REPLIES_KEY], (result) => {
                resolve(Array.isArray(result[SAVED_REPLIES_KEY]) ? result[SAVED_REPLIES_KEY] : []);
            });
        });
    }

    function persistSavedReplies(list) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [SAVED_REPLIES_KEY]: list }, resolve);
        });
    }

    async function renderRepliesView() {
        output.innerHTML = "";
        const replies = await loadSavedReplies();

        const intro = document.createElement("div");
        intro.className = "panel";
        intro.innerHTML = `
            <div class="panel-head"><h2>Saved replies</h2></div>
            <div class="panel-note">
                When a guest message matches a trigger, Alt+R answers with your saved
                text instead of drafting one &mdash; instant, and the same words every
                time. <strong>Separate phrasings with commas.</strong> Matching needs
                most of one phrase&rsquo;s words present, so a few short phrasings beat
                one long one.
            </div>`;
        output.appendChild(intro);

        if (replies.length === 0) {
            const empty = document.createElement("div");
            empty.className = "empty";
            empty.textContent = "No saved replies yet.";
            output.appendChild(empty);
        } else {
            const list = document.createElement("div");
            list.className = "panel";
            replies.forEach((reply, index) => {
                const row = document.createElement("div");
                row.className = "row";

                const main = document.createElement("div");
                main.className = "row-main";
                main.innerHTML = `<div class="row-title">${escapeHtml(reply.trigger)}</div>
                    <div class="row-sub">${escapeHtml(reply.text)}</div>`;
                row.appendChild(main);

                const del = document.createElement("button");
                del.className = "mini-btn danger";
                del.textContent = "Delete";
                del.addEventListener("click", async () => {
                    const next = replies.slice();
                    next.splice(index, 1);
                    await persistSavedReplies(next);
                    await renderRepliesView();
                });
                row.appendChild(del);

                list.appendChild(row);
            });
            output.appendChild(list);
        }

        // --- add one ---------------------------------------------------------
        const form = document.createElement("div");
        form.className = "panel";
        form.innerHTML = `<div class="panel-head"><h2>Add a reply</h2></div>`;

        const triggerField = document.createElement("label");
        triggerField.className = "field";
        triggerField.innerHTML = `<label for="replyTrigger">When a guest asks about</label>
            <input type="text" id="replyTrigger" placeholder="lockbox code, key location, where is the key">`;
        form.appendChild(triggerField);

        const textField = document.createElement("label");
        textField.className = "field";
        textField.innerHTML = `<label for="replyText">Send this</label>
            <textarea id="replyText" rows="4" placeholder="The lockbox is on the driver's door handle. Code is in your check-in message."></textarea>`;
        form.appendChild(textField);

        const actions = document.createElement("div");
        actions.className = "form-actions";
        const save = document.createElement("button");
        save.className = "mini-btn primary";
        save.textContent = "Save reply";
        actions.appendChild(save);
        const hint = document.createElement("span");
        hint.className = "row-sub";
        actions.appendChild(hint);
        form.appendChild(actions);
        output.appendChild(form);

        save.addEventListener("click", async () => {
            const trigger = form.querySelector("#replyTrigger").value.trim();
            const text = form.querySelector("#replyText").value.trim();

            if (!trigger || !text) {
                hint.textContent = "Both fields are needed.";
                return;
            }
            // The matcher scores on keywords longer than two characters, so a
            // one-word trigger matches almost nothing and would look broken.
            if (trigger.split(/\s+/).filter((w) => w.length > 2).length === 0) {
                hint.textContent = "Use a few real words, not one short one.";
                return;
            }

            await persistSavedReplies([...replies, { trigger, text, created: Date.now() }]);
            await renderRepliesView();
        });
    }

    // ---------- small shared helpers for the two views above ----------

    function makeSwitch(checked, onChange, label) {
        const wrap = document.createElement("label");
        wrap.className = "switch";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = Boolean(checked);
        if (label) input.setAttribute("aria-label", label);
        input.addEventListener("change", () => onChange(input.checked));

        const track = document.createElement("span");
        wrap.append(input, track);
        return wrap;
    }

    /**
     * Paired / not paired, in the header, on every view.
     *
     * "Why is nothing syncing" is the question this panel gets asked most, and
     * the answer was three clicks away under Sync.
     */
    async function refreshPairPill() {
        const pill = document.getElementById("pairPill");
        if (!pill) return;

        const { url, apiKey } = await getHostOSConfig();
        if (apiKey) {
            pill.textContent = "Paired";
            pill.className = "pair-pill ok";
            pill.title = `Syncing to ${url}`;
        } else {
            pill.textContent = "Not paired";
            pill.className = "pair-pill warn";
            pill.title = "Open the Sync tab and paste your pairing key.";
        }
    }

    /** Unread alert count on the Alerts tab, so it's visible without opening it. */
    async function refreshAlertsTabCount() {
        const badge = document.getElementById("alertsTabCount");
        if (!badge) return;

        const { alertBadge = 0 } = await chrome.storage.session.get("alertBadge");
        if (alertBadge > 0) {
            badge.textContent = alertBadge > 99 ? "99+" : String(alertBadge);
            badge.hidden = false;
        } else {
            badge.hidden = true;
        }
    }

    document.getElementById("openDashboard")?.addEventListener("click", async (e) => {
        e.preventDefault();
        const { url } = await getHostOSConfig();
        chrome.tabs.create({ url });
    });

    /** Shows the trailing fade only while the tab strip actually overflows. */
    function syncTabOverflow() {
        const strip = document.querySelector(".tabs");
        const wrap = document.querySelector(".tabs-wrap");
        if (!strip || !wrap) return;
        const more = strip.scrollWidth - strip.clientWidth - strip.scrollLeft > 4;
        wrap.classList.toggle("scrollable", more);
    }

    document.querySelector(".tabs")?.addEventListener("scroll", syncTabOverflow);
    window.addEventListener("resize", syncTabOverflow);

    refreshPairPill();
    refreshAlertsTabCount();
    syncTabOverflow();

    // ---------- Synchronization (pairing) ----------

    async function renderSyncView() {
        output.innerHTML = "";

        const { url, apiKey } = await getHostOSConfig();
        const last = await loadLastSyncResult();

        const section = document.createElement("div");
        section.className = "section";

        const header = document.createElement("div");
        header.className = "section-header";
        const h2 = document.createElement("h2");
        h2.textContent = url && apiKey ? "Connected" : "Connect to HostOS";
        header.appendChild(h2);
        section.appendChild(header);

        const body = document.createElement("div");
        body.style.padding = "10px";
        body.innerHTML = `
            <div class="form-row">
                <label>HostOS URL</label>
                <input type="text" class="f-hostos-url" placeholder="http://localhost:3000">
            </div>
            <div class="form-row">
                <label>Pairing key</label>
                <input type="text" class="f-hostos-key" placeholder="hostos_live_...">
            </div>
        `;
        section.appendChild(body);

        const urlInput = body.querySelector(".f-hostos-url");
        const keyInput = body.querySelector(".f-hostos-key");
        urlInput.value = url;
        keyInput.value = apiKey;

        const actions = document.createElement("div");
        actions.className = "form-actions";
        actions.style.padding = "0 10px 10px 10px";

        const statusEl = document.createElement("div");
        statusEl.style.flex = "1 1 auto";
        statusEl.style.fontSize = "11px";
        statusEl.style.color = "var(--text-faint)";
        statusEl.textContent = url && apiKey
            ? `Paired with ${url}. Last sync: ${formatSyncTime(last && last.at)}.`
            : "Not connected.";
        actions.appendChild(statusEl);

        const connectBtn = document.createElement("button");
        connectBtn.className = "form-save";
        connectBtn.textContent = "Connect";
        actions.appendChild(connectBtn);

        section.appendChild(actions);
        output.appendChild(section);

        if (url && apiKey) {
            const syncNowBtn = document.createElement("button");
            syncNowBtn.className = "fleet-add-btn";
            syncNowBtn.style.margin = "0 10px 10px 10px";
            syncNowBtn.textContent = "Sync Now";
            syncNowBtn.addEventListener("click", async () => {
                syncNowBtn.disabled = true;
                syncNowBtn.textContent = "Syncing...";
                const result = await performSync();
                syncNowBtn.disabled = false;
                syncNowBtn.textContent = "Sync Now";
                statusEl.textContent = result.ok
                    ? `Synced ${result.tripsProcessed} trip(s), ${result.eventsCreated} change(s) detected.`
                    : `Sync failed: ${result.error}`;
            });
            output.appendChild(syncNowBtn);
        }

        connectBtn.addEventListener("click", async () => {
            const newUrl = urlInput.value.trim().replace(/\/+$/, "");
            const newKey = keyInput.value.trim();

            if (!newUrl || !newKey) {
                statusEl.textContent = "Enter both a HostOS URL and a pairing key.";
                return;
            }

            connectBtn.disabled = true;
            connectBtn.textContent = "Connecting...";

            try {
                const origin = new URL(newUrl).origin + "/*";
                const granted = await new Promise((resolve) => {
                    chrome.permissions.request({ origins: [origin] }, resolve);
                });

                if (!granted) {
                    statusEl.textContent = "Permission to reach that URL was declined.";
                    connectBtn.disabled = false;
                    connectBtn.textContent = "Connect";
                    return;
                }

                await saveHostOSConfig(newUrl, newKey);
                const result = await performSync();
                connectBtn.disabled = false;
                connectBtn.textContent = "Connect";

                if (result.ok) {
                    statusEl.textContent = `Connected. Synced ${result.tripsProcessed} trip(s).`;
                } else {
                    statusEl.textContent = `Saved, but the first sync failed: ${result.error}`;
                }
                await renderSyncView();
            } catch (err) {
                connectBtn.disabled = false;
                connectBtn.textContent = "Connect";
                statusEl.textContent = `Invalid URL: ${err.message}`;
            }
        });
    }

    // Upcoming check-ins (any date label) whose actual pickup time is within
    // the next 24 hours. Lets the VA check each guest's driver's-license
    // status on Turo and send a reminder before pickup if it's still
    // "Awaiting license" — same fetch-then-review-then-send shape as the
    // extras/child-seat flow above.
    function renderLicenseCheck(entries) {
        const section = document.createElement("div");
        section.className = "section";

        const header = document.createElement("div");
        header.className = "section-header";

        const h2 = document.createElement("h2");
        h2.textContent = `License Verification — Trips Starting Within 24h (${entries.length})`;
        header.appendChild(h2);

        const headerBtns = document.createElement("div");
        headerBtns.style.display = "flex";
        headerBtns.style.gap = "6px";

        const fetchBtn = document.createElement("button");
        fetchBtn.textContent = "Fetch License Status";
        headerBtns.appendChild(fetchBtn);

        header.appendChild(headerBtns);
        section.appendChild(header);

        const list = document.createElement("div");
        list.className = "card-list";

        const cardRefs = new Map(); // entry.id -> { entry, statusEl }

        entries.forEach(entry => {
            const { card, statusEl } = renderLicenseCard(entry);
            cardRefs.set(entry.id, { entry, statusEl });
            list.appendChild(card);
        });

        section.appendChild(list);

        fetchBtn.addEventListener("click", async () => {
            await fetchLicenseStatusForEntries(entries, cardRefs, fetchBtn);
        });

        return section;
    }

    function renderLicenseCard(entry) {
        const card = document.createElement("div");
        card.className = "card extras";

        const body = document.createElement("div");
        body.className = "card-body";

        const dateEl = document.createElement("div");
        dateEl.className = "card-date";
        const startsIn = entry.startTs ? formatMsUntil(entry.startTs - Date.now()) : "";
        dateEl.textContent = `${entry.dateStr} \u2014 Starting at ${entry.parsed.time || "?"}${startsIn ? ` (${startsIn})` : ""}`;
        body.appendChild(dateEl);

        const vehicleEl = document.createElement("div");
        vehicleEl.className = "vehicle-line";
        vehicleEl.textContent = entry.fleet
            ? `${entry.fleet.color} ${entry.fleet.make} ${entry.fleet.model} ${entry.fleet.year}`
            : [entry.parsed.vehicleMake, entry.parsed.vehicleModel, entry.parsed.vehicleYear].filter(Boolean).join(" ") || "Unknown vehicle";
        body.appendChild(vehicleEl);

        const plateEl = document.createElement("div");
        plateEl.className = "plate-badge";
        plateEl.innerHTML = `<span>${escapeHtml(entry.parsed.plate || "UNKNOWN")}</span>${entry.fleet && entry.fleet.lockbox ? `<span class="lockbox">Lockbox ${escapeHtml(entry.fleet.lockbox)}</span>` : ""}`;
        body.appendChild(plateEl);

        if (entry.parsed.guest) {
            const guestEl = document.createElement("div");
            guestEl.className = "action-line";
            guestEl.textContent = `${entry.parsed.guest}${entry.parsed.reservation ? " #" + entry.parsed.reservation : ""}`;
            body.appendChild(guestEl);
        }

        const statusEl = document.createElement("div");
        statusEl.className = "task-chips";
        statusEl.style.marginTop = "6px";
        statusEl.style.fontSize = "11px";
        statusEl.style.color = "var(--text-faint)";
        statusEl.textContent = entry.parsed.reservation ? "Not checked yet" : "No reservation # detected \u2014 can't look up license status.";
        body.appendChild(statusEl);

        card.appendChild(body);

        return { card, statusEl };
    }

    // Rough "starts in Xh Ym" label for the license-check card header —
    // purely informational, doesn't affect eligibility (that's computed in
    // generator.js from the real timestamps).
    function formatMsUntil(ms) {
        if (ms == null || isNaN(ms) || ms < 0) return "";
        const totalMinutes = Math.round(ms / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours <= 0) return `in ${minutes}m`;
        return `in ${hours}h ${minutes}m`;
    }

    // Opens each reservation's detail page in a background tab, one at a
    // time, scrapes the license confirmation status, updates that card's
    // status line in place, then closes the tab and moves to the next —
    // same throttled background-tab pattern as fetchQuantitiesForEntries.
    async function fetchLicenseStatusForEntries(entries, cardRefs, triggerBtn) {
        const withReservation = entries.filter(e => e.parsed.reservation);
        const skippedCount = entries.length - withReservation.length;

        triggerBtn.disabled = true;
        const originalLabel = triggerBtn.textContent;

        for (let i = 0; i < withReservation.length; i++) {
            const entry = withReservation[i];
            triggerBtn.textContent = `Checking ${i + 1}/${withReservation.length}...`;

            const ref = cardRefs.get(entry.id);

            try {
                const url = `https://turo.com/us/en/reservation/${entry.parsed.reservation}`;
                const tab = await chrome.tabs.create({ url, active: false });

                await waitForTabComplete(tab.id, 12000);
                await delay(1200 + Math.floor(Math.random() * 500));

                const response = await sendMessageToTabSafe(tab.id, { action: "scanReservationLicenseStatus" });

                await chrome.tabs.remove(tab.id);

                entry.licenseStatus = response || { found: false, submitted: null, statusText: null };

                if (ref) {
                    if (entry.licenseStatus.submitted === true) {
                        ref.statusEl.textContent = `\u2713 ${entry.licenseStatus.statusText || "License confirmed"}`;
                        ref.statusEl.style.color = "var(--green)";
                    } else if (entry.licenseStatus.submitted === false) {
                        ref.statusEl.textContent = isLicenseReminderSent(entry.parsed.reservation)
                            ? "Awaiting license \u2014 reminder already sent"
                            : "\u26a0 Awaiting license";
                        ref.statusEl.style.color = "var(--red)";
                    } else {
                        ref.statusEl.textContent = entry.licenseStatus.statusText
                            ? `Unclear status: "${entry.licenseStatus.statusText}" \u2014 check manually`
                            : "Couldn't find license section \u2014 check manually";
                        ref.statusEl.style.color = "var(--text-faint)";
                    }
                }
            } catch (err) {
                entry.licenseStatus = { found: false, submitted: null, statusText: null };
                if (ref) {
                    ref.statusEl.textContent = `Error checking status \u2014 ${err.message}`;
                    ref.statusEl.style.color = "var(--red)";
                }
                console.error("Failed to fetch license status for reservation", entry.parsed.reservation, err);
            }

            await delay(700 + Math.floor(Math.random() * 500));
        }

        triggerBtn.textContent = originalLabel;
        triggerBtn.disabled = false;

        if (skippedCount > 0) {
            status.textContent = `Checked license status where possible — ${skippedCount} trip(s) had no reservation # to look up.`;
        }
    }


    function renderSkipped(entries) {
        const details = document.createElement("details");
        details.className = "section skipped-section";

        const summary = document.createElement("summary");
        summary.textContent = `Not actionable today (${entries.length}) — in progress / already checked in`;
        details.appendChild(summary);

        const list = document.createElement("div");
        list.className = "card-list";

        entries.forEach(entry => {
            const card = document.createElement("div");
            card.className = "card skipped";

            const pre = document.createElement("pre");
            const firstLine = (entry.rawLines && entry.rawLines[0]) || entry.parsed.skipReason || "";
            const plateLine = entry.rawLines.find(l => /^[A-Z0-9]{5,8}$/.test(l.replace(/\s+/g, "")));
            pre.textContent = `${firstLine}${plateLine ? " — " + plateLine : ""}`;
            card.appendChild(pre);

            list.appendChild(card);
        });

        details.appendChild(list);
        return details;
    }

    function copyToClipboard(text, btn) {
        navigator.clipboard.writeText(text).then(() => {
            const original = btn.textContent;
            btn.textContent = "Copied!";
            btn.classList.add("copied");
            setTimeout(() => {
                btn.textContent = original;
                btn.classList.remove("copied");
            }, 1200);
        }).catch(() => {
            btn.textContent = "Failed";
        });
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

});
