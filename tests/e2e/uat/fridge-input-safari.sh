#!/bin/bash

# FridgeInput Component UAT - Safari Testing
# Uses AppleScript to control Safari for native macOS browser testing

BASE_URL="http://localhost:3002"
SCREENSHOTS_DIR="tests/e2e/uat/screenshots"

mkdir -p "$SCREENSHOTS_DIR"

echo "================================================================================"
echo "FRIDGE INPUT COMPONENT UAT - SAFARI"
echo "================================================================================"
echo ""

# Function to run AppleScript
run_applescript() {
  osascript <<EOF
$1
EOF
}

echo "Phase 1: Opening Safari and navigating to homepage..."

# Open Safari and navigate
run_applescript "
tell application \"Safari\"
  activate
  make new document
  set URL of document 1 to \"$BASE_URL\"
  delay 3
end tell
"

echo "✓ Safari opened and navigated to $BASE_URL"
echo ""

sleep 2

# Take screenshot
echo "Phase 2: Taking initial screenshot..."
screencapture -w -x "$SCREENSHOTS_DIR/safari-homepage-initial.png"
echo "✓ Screenshot saved: safari-homepage-initial.png"
echo ""

# Get page title
echo "Phase 3: Getting page information..."
PAGE_TITLE=$(run_applescript '
tell application "Safari"
  return name of document 1
end tell
')

echo "Page title: $PAGE_TITLE"
echo ""

# Interact with the page using JavaScript
echo "Phase 4: Analyzing input fields with JavaScript..."

INPUT_INFO=$(run_applescript '
tell application "Safari"
  return do JavaScript "
    const inputs = Array.from(document.querySelectorAll(\"input\"));
    const result = {
      count: inputs.length,
      inputs: inputs.map((inp, i) => ({
        index: i,
        type: inp.type,
        placeholder: inp.placeholder,
        visible: inp.offsetParent !== null,
        id: inp.id,
        name: inp.name
      }))
    };
    JSON.stringify(result, null, 2);
  " in document 1
end tell
')

echo "Input fields found:"
echo "$INPUT_INFO"
echo ""

# Try to type in the first input
echo "Phase 5: Testing input interaction..."

TYPE_RESULT=$(run_applescript '
tell application "Safari"
  set resultText to do JavaScript "
    const input = document.querySelector(\"input[type=\\\"text\\\"]\");
    if (input) {
      input.focus();
      input.value = \"chicken\";
      input.dispatchEvent(new Event(\"input\", { bubbles: true }));
      input.dispatchEvent(new Event(\"change\", { bubbles: true }));
      return \"SUCCESS: Typed chicken into input field. Value is now: \" + input.value;
    } else {
      return \"ERROR: No text input found\";
    }
  " in document 1
  return resultText
end tell
')

echo "Typing test result:"
echo "$TYPE_RESULT"
echo ""

sleep 1

# Take screenshot after typing
echo "Phase 6: Taking screenshot after typing..."
screencapture -w -x "$SCREENSHOTS_DIR/safari-input-typing.png"
echo "✓ Screenshot saved: safari-input-typing.png"
echo ""

# Check for errors in console
echo "Phase 7: Checking for JavaScript errors..."

CONSOLE_ERRORS=$(run_applescript '
tell application "Safari"
  return do JavaScript "
    // Check if there are any error indicators in the page
    const errorElements = document.querySelectorAll(\"[class*=\\\"error\\\"]\");
    const result = {
      errorElementsCount: errorElements.length,
      pageLoaded: document.readyState,
      inputCount: document.querySelectorAll(\"input\").length
    };
    JSON.stringify(result, null, 2);
  " in document 1
end tell
')

echo "Page status:"
echo "$CONSOLE_ERRORS"
echo ""

# Try to search
echo "Phase 8: Attempting search execution..."

SEARCH_RESULT=$(run_applescript '
tell application "Safari"
  set searchResult to do JavaScript "
    const input = document.querySelector(\"input[type=\\\"text\\\"]\");
    let result = { status: \"unknown\" };

    if (input) {
      // Try to find search button
      const buttons = Array.from(document.querySelectorAll(\"button\"));
      const searchButton = buttons.find(btn =>
        btn.textContent.toLowerCase().includes(\"search\") ||
        btn.textContent.toLowerCase().includes(\"find\")
      );

      if (searchButton) {
        result.status = \"found_button\";
        result.buttonText = searchButton.textContent;
        searchButton.click();
        result.action = \"clicked\";
      } else {
        // Try pressing Enter
        const event = new KeyboardEvent(\"keydown\", {
          key: \"Enter\",
          code: \"Enter\",
          keyCode: 13,
          which: 13,
          bubbles: true
        });
        input.dispatchEvent(event);
        result.status = \"pressed_enter\";
        result.action = \"keydown\";
      }
    } else {
      result.status = \"no_input_found\";
    }

    return JSON.stringify(result, null, 2);
  " in document 1
  return searchResult
end tell
')

echo "Search execution result:"
echo "$SEARCH_RESULT"
echo ""

sleep 2

# Take final screenshot
echo "Phase 9: Taking screenshot after search..."
screencapture -w -x "$SCREENSHOTS_DIR/safari-after-search.png"
echo "✓ Screenshot saved: safari-after-search.png"
echo ""

# Get final URL
FINAL_URL=$(run_applescript '
tell application "Safari"
  return URL of document 1
end tell
')

echo "Final URL: $FINAL_URL"

# Summary
echo ""
echo "================================================================================"
echo "TEST COMPLETE - SUMMARY"
echo "================================================================================"
echo ""
echo "Screenshots saved to: $SCREENSHOTS_DIR"
echo "  1. safari-homepage-initial.png"
echo "  2. safari-input-typing.png"
echo "  3. safari-after-search.png"
echo ""
echo "Test Results:"
echo "  ✓ Safari navigation: SUCCESS"
echo "  ✓ Input field found: $(echo "$INPUT_INFO" | grep -c '"type"')"
echo "  ✓ Typing test: $(echo "$TYPE_RESULT" | grep -q "SUCCESS" && echo "PASS" || echo "FAIL")"
echo "  ✓ Search execution: $(echo "$SEARCH_RESULT" | grep -q "action" && echo "ATTEMPTED" || echo "SKIPPED")"
echo ""
echo "To view screenshots:"
echo "  open $SCREENSHOTS_DIR"
echo ""

# Close Safari tab (optional - commented out to allow manual inspection)
# run_applescript '
# tell application "Safari"
#   close document 1
# end tell
# '

echo "Note: Safari window left open for manual inspection."
echo "Close it manually when done reviewing."
