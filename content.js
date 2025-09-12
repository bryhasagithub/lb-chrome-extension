// Content script for LuckyBird.io tip tracking
;(function () {
  "use strict"

  let tipTransactions = []
  let currentUser = null
  let isScraping = false
  let currentPage = 1

  let maxPages = 20 // Default page limit (max: 500)

  // Function to find element by text content
  function findElementByText(selector, text) {
    const elements = document.querySelectorAll(selector)
    for (let element of elements) {
      if (element.textContent.includes(text)) {
        return element
      }
    }
    return null
  }

  // Function to navigate to tips page
  async function navigateToTipsPage() {
    try {
      console.log("🚀 Starting navigation to tips page...")

      // Click the Buy button to open the store modal
      const buyButton =
        findElementByText("button", "Buy") ||
        findElementByText("p", "Buy") ||
        findElementByText("span", "Buy") ||
        document.querySelector('button[class*="buy"]') ||
        document.querySelector("p.button_primary") ||
        document.querySelector('[class*="button_primary"]')

      console.log("🔍 Looking for Buy button...")
      console.log("Buy button found:", buyButton)

      if (buyButton) {
        console.log("✅ Clicking Buy button")
        buyButton.click()
        await sleep(500) // Wait longer for modal to open
        console.log("⏳ Waited 0.5 seconds after Buy click")

        // Check what's available in the modal
        console.log("🔍 Checking what's available in the modal...")
        const modalElements = document.querySelectorAll("div, span, button")
        const tabTexts = []
        modalElements.forEach((el) => {
          const text = el.textContent.trim()
          if (
            text === "Buy" ||
            text === "Redeem" ||
            text === "Rain" ||
            text === "Tips" ||
            text === "Daily Bonus"
          ) {
            tabTexts.push({
              text,
              element: el,
              tagName: el.tagName,
              className: el.className,
            })
          }
        })
        console.log("Available tabs found:", tabTexts)
      } else {
        console.log("❌ Buy button not found")
      }

      // Click the Tips tab in the modal
      console.log("🔍 Looking for Tips tab...")

      // First, find all Tips elements and filter out the main app div
      const allTipsElements = []
      const allElements = document.querySelectorAll("*")

      for (let element of allElements) {
        if (
          element.textContent.trim() === "Tips" &&
          element.offsetParent !== null
        ) {
          allTipsElements.push({
            element: element,
            tagName: element.tagName,
            className: element.className,
            isClickable:
              element.onclick !== null ||
              element.style.cursor === "pointer" ||
              element.getAttribute("role") === "button" ||
              element.tagName === "BUTTON" ||
              element.tagName === "A",
          })
        }
      }

      console.log("All Tips elements found:", allTipsElements.length)
      allTipsElements.forEach((item, i) => {
        console.log(
          `Tips element ${i}:`,
          item.tagName,
          item.className,
          "clickable:",
          item.isClickable
        )
      })

      // Look for the Tips tab specifically in navigation areas
      let tipsTab = null

      // Method 1: Look for Tips in navigation containers
      const navContainers = document.querySelectorAll(
        '[class*="nav"], [class*="tab"], .tw-nav'
      )
      for (let container of navContainers) {
        const tipsInNav = container.querySelectorAll("*")
        for (let el of tipsInNav) {
          if (el.textContent.trim() === "Tips" && el.offsetParent !== null) {
            console.log(
              "Found Tips in navigation container:",
              el.tagName,
              el.className
            )
            tipsTab = el
            break
          }
        }
        if (tipsTab) break
      }

      // Method 2: Look for clickable Tips elements (buttons, links, etc.)
      if (!tipsTab) {
        for (let item of allTipsElements) {
          if (item.isClickable) {
            console.log(
              "Found clickable Tips element:",
              item.tagName,
              item.className
            )
            tipsTab = item.element
            break
          }
        }
      }

      // Method 3: Look for Tips elements that are small (likely tabs, not main content)
      if (!tipsTab) {
        for (let item of allTipsElements) {
          const rect = item.element.getBoundingClientRect()
          if (rect.width < 200 && rect.height < 100) {
            // Small elements are likely tabs
            console.log(
              "Found small Tips element (likely tab):",
              item.tagName,
              item.className,
              "size:",
              rect.width,
              "x",
              rect.height
            )
            tipsTab = item.element
            break
          }
        }
      }

      // Method 4: Fallback to first Tips element that's not the main app div
      if (!tipsTab && allTipsElements.length > 0) {
        for (let item of allTipsElements) {
          if (!item.element.id || item.element.id !== "app") {
            console.log(
              "Using fallback Tips element:",
              item.tagName,
              item.className
            )
            tipsTab = item.element
            break
          }
        }
      }

      console.log("Final Tips tab selected:", tipsTab)

      if (tipsTab) {
        console.log("✅ Clicking Tips tab")
        tipsTab.click()
        await sleep(1000) // Wait longer for content to load
        console.log("⏳ Waited 1 seconds after Tips click")

        // Wait for Tips content to load and look for Tips-specific elements
        console.log("🔍 Waiting for Tips content to load...")
        await sleep(1000)

        // Look for Tips-specific content to confirm we're on the right tab
        const tipsContent =
          document.querySelector('[class*="tip"], [class*="Tip"]') ||
          document.querySelector(
            'input[placeholder*="tip"], input[placeholder*="Tip"]'
          ) ||
          document.querySelector('button:contains("Send SC")')

        if (tipsContent) {
          console.log("✅ Tips content loaded successfully")
        } else {
          console.log("⚠️ Tips content not immediately visible, continuing...")
        }
      } else {
        console.log("❌ Tips tab not found")
      }

      // Click on "Tips Transactions" or similar
      // First, look specifically for "Tips Transactions" text
      const tipsTransactionsLink =
        findElementByText("span", "Tips Transactions") ||
        findElementByText("a", "Tips Transactions") ||
        findElementByText("button", "Tips Transactions")

      console.log("🔍 Looking for Tips Transactions link...")
      console.log("Tips Transactions link found:", tipsTransactionsLink)

      if (tipsTransactionsLink) {
        console.log("✅ Clicking Tips Transactions link")
        tipsTransactionsLink.click()
        await sleep(1000)
        console.log("⏳ Waited 1 seconds after Tips Transactions click")
        console.log("📍 Final URL:", window.location.href)
      } else {
        console.log("❌ Tips Transactions link not found")
        console.log("🔍 Looking for any Transactions links in Tips content...")

        // Look for Transactions links but exclude "Buy Transactions" and "Rule"
        const allTransactionLinks = document.querySelectorAll(
          "span, a, button, div"
        )
        let foundTransactionLink = null

        for (let element of allTransactionLinks) {
          const text = element.textContent.trim()
          console.log("Checking element:", text, element.tagName)

          if (
            text.includes("Transactions") &&
            !text.includes("Buy Transactions") &&
            !text.includes("Rule") &&
            !text.includes("Buy")
          ) {
            console.log("Found potential Transactions link:", text, element)
            foundTransactionLink = element
            break
          }
        }

        if (foundTransactionLink) {
          console.log("✅ Clicking fallback Transactions link")
          foundTransactionLink.click()
          await sleep(2000)
          console.log("⏳ Waited 2 seconds after fallback click")
          console.log("📍 Final URL:", window.location.href)
        } else {
          console.log("❌ No suitable Transactions link found")
          console.log("🔍 All available links with 'Transactions':")
          document.querySelectorAll("span, a, button, div").forEach((el, i) => {
            if (el.textContent.includes("Transactions")) {
              console.log(`  ${i}: "${el.textContent.trim()}" (${el.tagName})`)
            }
          })
        }
      }

      return true
    } catch (error) {
      console.error("Error navigating to tips page:", error)
      return false
    }
  }

  // Function to scrape transaction data from current page
  function scrapeTransactionPage() {
    const transactions = []

    console.log("🔍 Starting to scrape transaction page...")
    console.log("Current URL:", window.location.href)

    // Look for transaction table rows - target the specific Element UI structure
    const tableRows = document.querySelectorAll(
      "table.el-table__body tbody tr.el-table__row, table tbody tr.el-table__row"
    )

    console.log(`📊 Found ${tableRows.length} table rows`)

    // Also log all tables on the page for debugging
    const allTables = document.querySelectorAll("table")
    console.log(`📋 Found ${allTables.length} tables on page`)
    allTables.forEach((table, index) => {
      console.log(`Table ${index}:`, table.outerHTML.substring(0, 200) + "...")
    })

    tableRows.forEach((row, index) => {
      const cells = row.querySelectorAll("td.el-table__cell")
      console.log(`Row ${index}: ${cells.length} cells`)

      if (cells.length >= 4) {
        // Use the specific column classes from the HTML structure
        const fromCell = row.querySelector("td.el-table_2_column_6 .cell")
        const toCell = row.querySelector("td.el-table_2_column_7 .cell")
        const amountCell = row.querySelector("td.el-table_2_column_8 .cell")
        const dateCell = row.querySelector("td.el-table_2_column_9 .cell")

        const from = fromCell?.textContent?.trim()
        const to = toCell?.textContent?.trim()
        const amountText = amountCell?.textContent?.trim()
        const dateText = dateCell?.textContent?.trim()

        console.log(`Row ${index} data:`, { from, to, amountText, dateText })

        // Skip header row
        if (from === "From" || to === "To" || amountText === "Amount") {
          console.log(`Skipping header row ${index}`)
          return
        }

        // Extract amount and currency - look for amount_text span specifically
        let amount = null
        let currency = "SC" // Default currency

        // First try to find amount_text span in this row
        const amountSpan = row.querySelector(".amount_text")
        if (amountSpan) {
          const amountValue = amountSpan.textContent.trim()
          console.log(`Found amount_text span: "${amountValue}"`)

          // Check for currency icon
          const currencyImg = row.querySelector(".amount_img")
          if (currencyImg) {
            const imgSrc = currencyImg.src
            if (imgSrc.includes("usd.png")) {
              currency = "SC" // USD image = SC (Sweepstakes Cash)
            } else if (imgSrc.includes("gold.png")) {
              currency = "GC" // Gold image = GC (Gold Coins)
            }
          }

          // Parse the amount
          const amountMatch = amountValue.match(/([\d,]+\.?\d*)/)
          if (amountMatch) {
            amount = parseFloat(amountMatch[1].replace(/,/g, ""))
            console.log(`✅ Parsed amount: ${amount} ${currency}`)
          }
        }

        // Fallback to original method if amount_text not found
        if (amount === null) {
          const amountMatch = amountText?.match(
            /([\d,]+\.?\d*)\s*(Gold Coin|G|SC|\$|USD)/i
          )
          if (amountMatch) {
            amount = parseFloat(amountMatch[1].replace(/,/g, ""))
            currency = amountMatch[2].toUpperCase()
            console.log(`✅ Fallback amount parsing: ${amount} ${currency}`)
          }
        }

        if (amount !== null) {
          // Only collect SC transactions, skip GC transactions
          if (currency === "GC") {
            console.log(`⏭️ Skipping GC transaction: ${amount} ${currency}`)
            return
          }

          if (currency !== "SC") {
            console.log(`⏭️ Skipping non-SC transaction: ${amount} ${currency}`)
            return
          }

          // Parse date
          let timestamp = Date.now()
          if (dateText) {
            const dateMatch = dateText.match(
              /(\d{4}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}\s+[AP]M)/
            )
            if (dateMatch) {
              const dateStr = `${dateMatch[1]} ${dateMatch[2]}`
              timestamp = new Date(dateStr).getTime()
            }
          }

          const transaction = {
            from: from || "Unknown",
            to: to || "Unknown",
            amount: amount,
            currency: currency,
            timestamp: timestamp,
            date: dateText || new Date(timestamp).toLocaleString(),
          }

          console.log(`💾 Adding SC transaction:`, transaction)
          transactions.push(transaction)
        } else {
          console.log(`❌ No amount found for row ${index}:`, amountText)
        }
      } else {
        console.log(`⚠️ Row ${index} has only ${cells.length} cells, skipping`)
      }
    })

    console.log(
      `🎯 Total transactions found on this page: ${transactions.length}`
    )
    return transactions
  }

  // Function to check if there are more pages
  function hasNextPage() {
    console.log("🔍 Checking for next page...")

    // Look for pagination - target the specific Element UI structure
    const pagination = document.querySelector("div.el-pagination.is-background")

    console.log("Pagination container found:", pagination)

    if (pagination) {
      // Look for next button - target the specific Element UI structure
      let nextButton = pagination.querySelector(
        "button.btn-next:not([disabled])"
      )

      // Also look for right arrow or ">" text
      if (!nextButton) {
        const allButtons = pagination.querySelectorAll("button, a, span, div")
        for (let btn of allButtons) {
          const text = btn.textContent.trim()
          if (
            (text === ">" || text === "Next" || text.includes("→")) &&
            !btn.disabled
          ) {
            nextButton = btn
            break
          }
        }
      }

      console.log("Next button found:", nextButton)

      if (nextButton && !nextButton.disabled) {
        console.log("✅ Next button is enabled")
        return true
      }

      // Check current page vs total pages - target the specific Element UI structure
      const currentPageEl = pagination.querySelector("li.number.active")
      const allPageNumbers = pagination.querySelectorAll("li.number")

      console.log("Current page element:", currentPageEl)
      console.log("All page numbers found:", allPageNumbers.length)

      if (currentPageEl) {
        const current = parseInt(currentPageEl.textContent)
        console.log("Current page:", current)

        // Check if there's a next button or if we can find the last page number
        const lastPageNumber = Array.from(allPageNumbers)
          .map((el) => parseInt(el.textContent))
          .filter((num) => !isNaN(num))
          .sort((a, b) => b - a)[0]

        console.log("Last page number found:", lastPageNumber)

        if (lastPageNumber && current < lastPageNumber) {
          console.log("✅ More pages available")
          return true
        }
      }
    }

    // Fallback: look for any pagination elements on the page
    const allPaginationElements = document.querySelectorAll(
      '[class*="pagination"], [class*="page"], .el-pager'
    )
    console.log("All pagination elements found:", allPaginationElements.length)

    allPaginationElements.forEach((el, i) => {
      console.log(
        `Pagination element ${i}:`,
        el.className,
        el.textContent.trim()
      )
    })

    console.log("❌ No more pages available")
    return false
  }

  // Function to go to next page
  async function goToNextPage() {
    console.log("🔍 Looking for next page button...")

    // Look for pagination container - target the specific Element UI structure
    const pagination = document.querySelector("div.el-pagination.is-background")

    let nextButton = null

    if (pagination) {
      // Look for next button - target the specific Element UI structure
      nextButton = pagination.querySelector("button.btn-next:not([disabled])")

      // Also look for right arrow or ">" text
      if (!nextButton) {
        const allButtons = pagination.querySelectorAll("button, a, span, div")
        for (let btn of allButtons) {
          const text = btn.textContent.trim()
          if (
            (text === ">" || text === "Next" || text.includes("→")) &&
            !btn.disabled
          ) {
            nextButton = btn
            break
          }
        }
      }
    }

    // Fallback: look for any next button on the page
    if (!nextButton) {
      const allButtons = document.querySelectorAll("button, a, span, div")
      for (let btn of allButtons) {
        const text = btn.textContent.trim()
        if (
          (text === ">" || text === "Next" || text.includes("→")) &&
          !btn.disabled
        ) {
          nextButton = btn
          break
        }
      }
    }

    console.log("Next button found:", nextButton)

    if (nextButton && !nextButton.disabled) {
      console.log("✅ Clicking next page button")
      nextButton.click()
      await sleep(1000)
      console.log("⏳ Waited 1 seconds after next page click")
      return true
    }

    console.log("❌ Next page button not found or disabled")
    return false
  }

  // Function to calculate user balances (excluding current user)
  function calculateUserBalances(transactions) {
    const balances = {}

    transactions.forEach((tx) => {
      // Skip transactions where current user is involved
      if (tx.from === currentUser || tx.to === currentUser) {
        return
      }

      if (!balances[tx.from]) balances[tx.from] = 0
      if (!balances[tx.to]) balances[tx.to] = 0

      // Convert to USD for consistent calculation
      let amountUSD = tx.amount
      if (tx.currency === "G" || tx.currency === "GOLD COIN") {
        // Assuming 1 Gold Coin = $0.0001 (adjust as needed)
        amountUSD = tx.amount * 0.0001
      }

      balances[tx.from] -= amountUSD // Person who sent loses money
      balances[tx.to] += amountUSD // Person who received gains money
    })

    return balances
  }

  // Function to detect current user from the page
  function detectCurrentUser() {
    console.log("🔍 Attempting to detect current user...")

    // Try multiple detection methods
    const detectionMethods = [
      // Method 1: Look for common username selectors
      () => {
        const selectors = [
          "[data-username]",
          ".username",
          ".user-name",
          ".current-user",
          ".profile-name",
          ".account-name",
        ]
        for (let selector of selectors) {
          const element = document.querySelector(selector)
          if (element && element.textContent) {
            return element.textContent.trim()
          }
        }
        return null
      },

      // Method 2: Look in the URL or page title
      () => {
        const url = window.location.href
        const title = document.title
        // Look for patterns like /user/username or similar
        const urlMatch = url.match(/\/user\/([^\/\?]+)/)
        if (urlMatch) return urlMatch[1]
        return null
      },

      // Method 3: Look for elements with user-related classes
      () => {
        const elements = document.querySelectorAll(
          '*[class*="user"], *[class*="name"], *[class*="profile"]'
        )
        for (let element of elements) {
          if (element.textContent && element.textContent.trim()) {
            const text = element.textContent.trim()
            if (
              text.length > 2 &&
              text.length < 20 &&
              !text.includes(" ") &&
              !text.includes("@") &&
              !text.includes(":")
            ) {
              return text
            }
          }
        }
        return null
      },

      // Method 4: Look in localStorage or sessionStorage
      () => {
        try {
          const keys = Object.keys(localStorage)
          for (let key of keys) {
            if (
              key.toLowerCase().includes("user") ||
              key.toLowerCase().includes("name")
            ) {
              const value = localStorage.getItem(key)
              if (value && value.length > 2 && value.length < 20) {
                return value
              }
            }
          }
        } catch (e) {
          console.log("Could not access localStorage")
        }
        return null
      },
    ]

    for (let method of detectionMethods) {
      try {
        const result = method()
        if (result) {
          console.log("✅ Detected current user:", result)
          return result
        }
      } catch (e) {
        console.log("Detection method failed:", e)
      }
    }

    console.log("❌ Could not detect current user")
    return null
  }

  // Main scraping function
  async function startScraping(pageLimit = 20, incremental = false) {
    if (isScraping) return

    isScraping = true
    currentPage = 1
    maxPages = pageLimit

    // Load existing data if doing incremental update
    if (incremental) {
      const result = await chrome.storage.local.get([
        "tipTransactions",
        "lastUpdated",
      ])
      tipTransactions = result.tipTransactions || []
      console.log(
        `🔄 Incremental update: Starting with ${tipTransactions.length} existing transactions`
      )
    } else {
      tipTransactions = []
      console.log("🆕 Full scrape: Starting fresh")
    }

    // Try to detect current user if not already set
    if (!currentUser) {
      currentUser = detectCurrentUser()
      if (currentUser) {
        chrome.storage.local.set({ currentUser })
        console.log("✅ Current user set to:", currentUser)
      } else {
        console.log("⚠️ Could not detect current user, using default")
        currentUser = "unknown_user"
      }
    }

    try {
      // Navigate to tips page
      chrome.runtime.sendMessage({
        type: "SCRAPING_PROGRESS",
        progress: 10,
        message: "Navigating to tips page...",
      })

      const navigated = await navigateToTipsPage()
      if (!navigated) {
        throw new Error("Could not navigate to tips page")
      }

      // Check if we're on the correct page (should contain transaction data)
      const currentUrl = window.location.href
      console.log("📍 Current URL after navigation:", currentUrl)

      if (currentUrl.includes("vipRules") || currentUrl.includes("rules")) {
        throw new Error(
          "Navigated to wrong page (VIP Rules). Tips Transactions not found."
        )
      }

      // Look for transaction table to confirm we're on the right page
      const transactionTable = document.querySelector(
        'table, [class*="transaction"]'
      )
      if (!transactionTable) {
        console.log("⚠️ No transaction table found on current page")
        console.log(
          "Available tables:",
          document.querySelectorAll("table").length
        )
      } else {
        console.log("✅ Transaction table found, proceeding with scraping")
      }

      // Scrape all pages
      let newTransactionsCount = 0
      let foundExistingTransaction = false

      while (true) {
        const pageTransactions = scrapeTransactionPage()

        // For incremental updates, check if we've seen these transactions before
        if (incremental && pageTransactions.length > 0) {
          const existingTransactionIds = new Set(
            tipTransactions.map(
              (tx) => `${tx.from}-${tx.to}-${tx.amount}-${tx.timestamp}`
            )
          )

          const newTransactions = []
          for (const transaction of pageTransactions) {
            const transactionId = `${transaction.from}-${transaction.to}-${transaction.amount}-${transaction.timestamp}`
            if (!existingTransactionIds.has(transactionId)) {
              newTransactions.push(transaction)
            } else {
              foundExistingTransaction = true
              console.log(
                `🔄 Found existing transaction, stopping incremental update`
              )
              break
            }
          }

          tipTransactions.push(...newTransactions)
          newTransactionsCount += newTransactions.length

          console.log(
            `Page ${currentPage}: Found ${pageTransactions.length} transactions, ${newTransactions.length} new`
          )

          // If we found existing transactions, we can stop here for incremental updates
          if (foundExistingTransaction) {
            console.log(
              `✅ Incremental update complete: Found ${newTransactionsCount} new transactions`
            )
            break
          }
        } else {
          tipTransactions.push(...pageTransactions)
          newTransactionsCount += pageTransactions.length

          console.log(
            `Page ${currentPage}: Found ${pageTransactions.length} transactions`
          )
        }

        chrome.runtime.sendMessage({
          type: "SCRAPING_PROGRESS",
          progress: 10 + (currentPage * 80) / 10, // Estimate progress
          message: `Scraping page ${currentPage}...`,
        })

        if (!hasNextPage() || currentPage >= maxPages) {
          // Use the page limit from popup
          break
        }

        const hasNext = await goToNextPage()
        if (!hasNext) {
          break
        }

        currentPage++
        await sleep(1000) // Wait between pages
      }

      // Calculate user balances
      const userBalances = calculateUserBalances(tipTransactions)

      // Store data
      await chrome.storage.local.set({
        tipTransactions: tipTransactions,
        userBalances: userBalances,
        lastUpdated: Date.now(),
      })

      chrome.runtime.sendMessage({
        type: "SCRAPING_PROGRESS",
        progress: 100,
        message: "Scraping complete!",
      })

      chrome.runtime.sendMessage({
        type: "SCRAPING_COMPLETE",
        data: {
          transactions: tipTransactions,
          userBalances: userBalances,
          newTransactionsCount: newTransactionsCount,
          incremental: incremental,
        },
      })
    } catch (error) {
      console.error("Scraping error:", error)
      chrome.runtime.sendMessage({
        type: "SCRAPING_ERROR",
        message: error.message,
      })
    } finally {
      isScraping = false
    }
  }

  // Utility function for delays
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "START_SCRAPING") {
      const pageLimit = request.pageLimit || 20
      const incremental = request.incremental || false
      startScraping(pageLimit, incremental)
      sendResponse({ success: true })
    } else if (request.type === "GET_TIPS") {
      sendResponse({ tipTransactions, currentUser })
    } else if (request.type === "SET_USER") {
      // Handle both single username and array of usernames
      if (Array.isArray(request.username)) {
        currentUser = request.username[0] // Use first username for detection purposes
        chrome.storage.local.set({ currentUser: request.username })
      } else {
        currentUser = request.username
        chrome.storage.local.set({ currentUser: request.username })
      }
    } else if (request.type === "CLEAR_TIPS") {
      tipTransactions = []
      chrome.storage.local.set({ tipTransactions: [] })
      sendResponse({ success: true })
    }
  })

  // Load existing data on startup
  chrome.storage.local.get(["tipTransactions", "currentUser"], (result) => {
    tipTransactions = result.tipTransactions || []
    // Handle both single username (legacy) and multiple usernames
    if (Array.isArray(result.currentUser)) {
      currentUser = result.currentUser[0] // Use first username for detection purposes
    } else {
      currentUser = result.currentUser
    }
  })

  console.log("Tip Tracker content script loaded for LuckyBird.io")
})()
