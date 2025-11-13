-- Safari Automation Test for System Recipe Ingestion
-- This script tests the navigation link and page load

tell application "Safari"
	activate
	delay 1

	-- Open admin page
	set adminURL to "http://localhost:3002/admin"
	make new document with properties {URL:adminURL}
	delay 3

	-- Get the current tab
	set currentTab to current tab of front window

	-- Wait for page to load
	repeat 20 times
		if (do JavaScript "document.readyState" in currentTab) is "complete" then
			exit repeat
		end if
		delay 0.5
	end repeat

	-- Check if System Recipe Ingest button exists
	set buttonExists to do JavaScript "
		const button = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('System Recipe Ingest'));
		if (button) {
			console.log('[TEST] System Recipe Ingest button found');
			console.log('[TEST] Button href:', button.href);
			console.log('[TEST] Button classes:', button.className);
			return true;
		}
		console.log('[TEST] System Recipe Ingest button NOT found');
		return false;
	" in currentTab

	if buttonExists is true then
		-- Click the button
		do JavaScript "
			const button = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('System Recipe Ingest'));
			if (button) {
				console.log('[TEST] Clicking System Recipe Ingest button');
				button.click();
			}
		" in currentTab

		delay 3

		-- Check if we're on the correct page
		set currentURL to URL of currentTab
		set pageTitle to do JavaScript "document.title" in currentTab

		-- Check for server function error
		set hasError to do JavaScript "
			const bodyText = document.body.innerText;
			const hasServerError = bodyText.includes('Server Functions cannot be called during initial render');
			if (hasServerError) {
				console.error('[TEST] ERROR: Server Functions error detected!');
			} else {
				console.log('[TEST] No server function errors detected');
			}
			return hasServerError;
		" in currentTab

		-- Check page elements
		do JavaScript "
			console.log('[TEST] Current URL:', window.location.href);
			console.log('[TEST] Page title:', document.title);

			// Check for tabs
			const urlTab = document.querySelector('[value=\"url\"]');
			const textTab = document.querySelector('[value=\"text\"]');
			console.log('[TEST] URL tab found:', !!urlTab);
			console.log('[TEST] Text tab found:', !!textTab);

			// Check for chefs dropdown
			const chefsDropdown = document.querySelector('#chef');
			console.log('[TEST] Chefs dropdown found:', !!chefsDropdown);

			// Check for main heading
			const heading = Array.from(document.querySelectorAll('h1')).find(h => h.textContent.includes('System Recipe Ingestion'));
			console.log('[TEST] Main heading found:', !!heading);

			// Check console for errors
			console.log('[TEST] === Test 1 & 2 Complete ===');
		" in currentTab

		return "SUCCESS: Navigation test completed. Check Safari console for details."
	else
		return "FAILURE: System Recipe Ingest button not found on admin page"
	end if
end tell
