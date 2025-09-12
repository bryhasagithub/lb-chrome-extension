// Popup script for Tip Tracker extension
document.addEventListener("DOMContentLoaded", function () {
  const scrapeButton = document.getElementById("scrapeButton")
  const refreshButton = document.getElementById("refreshButton")
  const clearButton = document.getElementById("clearButton")
  const exportCSVButton = document.getElementById("exportCSV")
  const exportJSONButton = document.getElementById("exportJSON")
  const currentUserInput = document.getElementById("currentUser")
  const excludeUsersInput = document.getElementById("excludeUsers")
  const pageLimitInput = document.getElementById("pageLimit")
  const statusDiv = document.getElementById("status")
  const progressContainer = document.getElementById("progressContainer")
  const progressBar = document.getElementById("progressBar")
  const progressText = document.getElementById("progressText")
  const userTableBody = document.getElementById("userTableBody")

  // Stats elements
  const totalTipsEl = document.getElementById("totalTips")
  const waitingOnEl = document.getElementById("waitingOn")
  const usersCountEl = document.getElementById("usersCount")
  const tipsOwedEl = document.getElementById("tipsOwed")

  let isScraping = false
  let currentSort = { column: "delta", direction: "desc" } // Default sort by delta descending

  // Helper function to get excluded users list
  function getExcludedUsers() {
    const excludeUsersText = excludeUsersInput.value.trim()
    if (!excludeUsersText) return []

    return excludeUsersText
      .split(",")
      .map((username) => username.trim().toLowerCase())
      .filter((username) => username.length > 0)
  }

  // Load and display current data
  loadData()

  // Load current user and exclude users from storage
  chrome.storage.local.get(["currentUser", "excludeUsers"], (result) => {
    if (result.currentUser) {
      currentUserInput.value = result.currentUser
    }
    if (result.excludeUsers) {
      excludeUsersInput.value = result.excludeUsers
    }
  })

  // Event listeners
  scrapeButton.addEventListener("click", startScraping)
  refreshButton.addEventListener("click", refreshData)
  clearButton.addEventListener("click", clearData)
  exportCSVButton.addEventListener("click", () => exportData("csv"))
  exportJSONButton.addEventListener("click", () => exportData("json"))

  // Save username when changed
  currentUserInput.addEventListener("blur", () => {
    const username = currentUserInput.value.trim()
    if (username) {
      chrome.storage.local.set({ currentUser: username })
      console.log("Username saved:", username)
    }
  })

  // Save exclude users when changed
  excludeUsersInput.addEventListener("blur", () => {
    const excludeUsers = excludeUsersInput.value.trim()
    chrome.storage.local.set({ excludeUsers: excludeUsers })
    console.log("Exclude users saved:", excludeUsers)
  })

  // Add sorting functionality
  function addSortingListeners() {
    const sortableHeaders = document.querySelectorAll(".sortable")
    sortableHeaders.forEach((header) => {
      header.addEventListener("click", () => {
        const sortColumn = header.dataset.sort
        handleSort(sortColumn)
      })
    })
  }

  function handleSort(column) {
    // Toggle direction if same column, otherwise set to ascending
    if (currentSort.column === column) {
      currentSort.direction = currentSort.direction === "asc" ? "desc" : "asc"
    } else {
      currentSort.direction = "asc"
    }
    currentSort.column = column

    // Update arrow indicators
    updateSortArrows()

    // Re-render the table with new sort
    chrome.storage.local.get(["tipTransactions", "userBalances"], (result) => {
      const transactions = result.tipTransactions || []
      const userBalances = result.userBalances || {}
      updateUserList(transactions, userBalances)
    })
  }

  function updateSortArrows() {
    const sortableHeaders = document.querySelectorAll(".sortable")
    sortableHeaders.forEach((header) => {
      const arrow = header.querySelector(".sort-arrow")
      const column = header.dataset.sort

      // Reset all arrows
      arrow.className = "sort-arrow"

      // Set active arrow
      if (column === currentSort.column) {
        arrow.classList.add(currentSort.direction)
      }
    })
  }

  function sortUsers(users) {
    return users.sort(([, a], [, b]) => {
      let aValue, bValue

      switch (currentSort.column) {
        case "user":
          aValue = a.username || ""
          bValue = b.username || ""
          break
        case "received":
          aValue = a.received || 0
          bValue = b.received || 0
          break
        case "sent":
          aValue = a.sent || 0
          bValue = b.sent || 0
          break
        case "delta":
          aValue = (a.received || 0) - (a.sent || 0)
          bValue = (b.received || 0) - (b.sent || 0)
          break
        default:
          return 0
      }

      // Handle string comparison
      if (typeof aValue === "string" && typeof bValue === "string") {
        const comparison = aValue.localeCompare(bValue)
        return currentSort.direction === "asc" ? comparison : -comparison
      }

      // Handle numeric/date comparison
      if (aValue < bValue) return currentSort.direction === "asc" ? -1 : 1
      if (aValue > bValue) return currentSort.direction === "asc" ? 1 : -1
      return 0
    })
  }

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SCRAPING_PROGRESS") {
      updateProgress(request.progress, request.message)
    } else if (request.type === "SCRAPING_COMPLETE") {
      scrapingComplete(request.data)
    } else if (request.type === "SCRAPING_ERROR") {
      showError(request.message)
    }
  })

  function loadData() {
    chrome.storage.local.get(
      ["tipTransactions", "lastUpdated", "userBalances"],
      (result) => {
        const transactions = result.tipTransactions || []
        const userBalances = result.userBalances || {}
        const lastUpdated = result.lastUpdated

        updateStats(transactions, userBalances, lastUpdated)
        updateUserList(transactions, userBalances)

        // Enable/disable refresh button based on whether we have data
        refreshButton.disabled = transactions.length === 0
        if (transactions.length === 0) {
          refreshButton.classList.add("refresh-disabled")
        } else {
          refreshButton.classList.remove("refresh-disabled")
        }
      }
    )
  }

  function updateStats(transactions, userBalances, lastUpdated) {
    totalTipsEl.textContent = transactions.length

    // Calculate waiting on and tips owed based on delta values
    let waitingOn = 0
    let tipsOwed = 0

    // Get current user from storage
    chrome.storage.local.get(["currentUser"], (result) => {
      const currentUser =
        result.currentUser || currentUserInput.value.trim() || "unknown_user"
      console.log("Current user for stats calculation:", currentUser)

      // Calculate detailed stats for each user (same logic as updateUserList)
      const userStats = {}
      const allUsers = new Set()

      // Collect all unique users from transactions
      transactions.forEach((transaction) => {
        allUsers.add(transaction.from)
        allUsers.add(transaction.to)
      })

      // Get excluded users list
      const excludedUsers = getExcludedUsers()
      console.log("Excluded users:", excludedUsers)

      // Initialize user stats for all users except current user and excluded users
      allUsers.forEach((username) => {
        const normalizedCurrentUser = currentUser.toLowerCase().trim()
        const normalizedUsername = username.toLowerCase().trim()

        // Skip current user
        if (
          currentUser !== "unknown_user" &&
          normalizedUsername === normalizedCurrentUser
        ) {
          console.log(`Skipping current user in stats: ${username}`)
          return
        }

        // Skip excluded users
        if (excludedUsers.includes(normalizedUsername)) {
          console.log(`Skipping excluded user in stats: ${username}`)
          return
        }

        userStats[username] = {
          sent: 0,
          received: 0,
          lastTransaction: null,
        }
      })

      // Process transactions to calculate sent/received amounts
      transactions.forEach((transaction) => {
        const { from, to, amount, timestamp } = transaction
        const amountNum = parseFloat(amount) || 0
        const transactionDate = new Date(timestamp)

        // Normalize usernames for comparison
        const normalizedCurrentUser = currentUser.toLowerCase().trim()
        const normalizedFrom = from.toLowerCase().trim()
        const normalizedTo = to.toLowerCase().trim()

        // Skip if both users are the current user
        if (
          currentUser !== "unknown_user" &&
          normalizedFrom === normalizedCurrentUser &&
          normalizedTo === normalizedCurrentUser
        ) {
          return
        }

        // Process transactions involving current user
        if (
          currentUser !== "unknown_user" &&
          (normalizedFrom === normalizedCurrentUser ||
            normalizedTo === normalizedCurrentUser)
        ) {
          if (normalizedFrom === normalizedCurrentUser) {
            // Current user sent to someone else - update the recipient's received amount
            if (userStats[to]) {
              userStats[to].received += amountNum
            }
          } else {
            // Someone else sent to current user - update the sender's sent amount
            if (userStats[from]) {
              userStats[from].sent += amountNum
            }
          }
        } else {
          // Transaction between two other users
          if (userStats[from]) {
            userStats[from].sent += amountNum
          }
          if (userStats[to]) {
            userStats[to].received += amountNum
          }
        }
      })

      // Calculate waiting on (positive deltas) and tips owed (negative deltas)
      console.log("User stats before delta calculation:", userStats)

      Object.entries(userStats).forEach(([username, stats]) => {
        const delta = stats.received - stats.sent
        console.log(
          `${username}: received=${stats.received}, sent=${stats.sent}, delta=${delta}`
        )

        if (delta > 0) {
          waitingOn += delta
          console.log(`Added ${delta} to waiting on (total: ${waitingOn})`)
        } else if (delta < 0) {
          tipsOwed += Math.abs(delta)
          console.log(
            `Added ${Math.abs(delta)} to tips owed (total: ${tipsOwed})`
          )
        }
      })

      console.log(
        "Final stats - Waiting on:",
        waitingOn,
        "Tips owed:",
        tipsOwed
      )
      waitingOnEl.textContent = `$${waitingOn.toFixed(2)}`
      tipsOwedEl.textContent = `$${tipsOwed.toFixed(2)}`

      // Update users count to show unique users tipped
      usersCountEl.textContent = Object.keys(userStats).length
    })
  }

  function updateUserList(transactions, userBalances) {
    console.log("updateUserList called with:", {
      transactions: transactions.length,
      userBalances: Object.keys(userBalances).length,
    })

    // Get current user for calculations
    chrome.storage.local.get(["currentUser"], (result) => {
      const currentUser =
        result.currentUser || currentUserInput.value.trim() || "unknown_user"
      console.log("Current user for table:", currentUser)
      console.log("Current user input value:", currentUserInput.value)
      console.log("Stored current user:", result.currentUser)

      // If no transactions, show no data message
      if (transactions.length === 0) {
        userTableBody.innerHTML =
          '<div class="no-data">No transactions found.</div>'
        return
      }

      // Calculate detailed stats for each user
      const userStats = {}
      const allUsers = new Set()

      // Collect all unique users from transactions
      transactions.forEach((transaction) => {
        allUsers.add(transaction.from)
        allUsers.add(transaction.to)
      })

      console.log("All users found in transactions:", Array.from(allUsers))

      // Get excluded users list
      const excludedUsers = getExcludedUsers()
      console.log("Excluded users for table:", excludedUsers)

      // Initialize user stats for all users except current user and excluded users
      allUsers.forEach((username) => {
        // Skip current user if we know who it is (case-insensitive comparison)
        const normalizedCurrentUser = currentUser.toLowerCase().trim()
        const normalizedUsername = username.toLowerCase().trim()

        if (
          currentUser !== "unknown_user" &&
          normalizedUsername === normalizedCurrentUser
        ) {
          console.log(
            `Skipping current user: ${username} (matches ${currentUser})`
          )
          return
        }

        // Skip excluded users
        if (excludedUsers.includes(normalizedUsername)) {
          console.log(`Skipping excluded user: ${username}`)
          return
        }

        userStats[username] = {
          sent: 0,
          received: 0,
          lastTransaction: null,
        }
      })

      console.log("User stats initialized for:", Object.keys(userStats))

      // Process transactions to calculate sent/received amounts and last transaction date
      transactions.forEach((transaction) => {
        const { from, to, amount, timestamp } = transaction
        const amountNum = parseFloat(amount) || 0
        const transactionDate = new Date(timestamp)

        console.log("Processing transaction:", {
          from,
          to,
          amount: amountNum,
          currentUser,
        })

        // Normalize usernames for comparison
        const normalizedCurrentUser = currentUser.toLowerCase().trim()
        const normalizedFrom = from.toLowerCase().trim()
        const normalizedTo = to.toLowerCase().trim()

        // Skip if both users are the current user (shouldn't happen)
        if (
          currentUser !== "unknown_user" &&
          normalizedFrom === normalizedCurrentUser &&
          normalizedTo === normalizedCurrentUser
        ) {
          console.log("Skipping self-to-self transaction")
          return
        }

        // Process transactions involving current user differently
        if (
          currentUser !== "unknown_user" &&
          (normalizedFrom === normalizedCurrentUser ||
            normalizedTo === normalizedCurrentUser)
        ) {
          // This is a transaction involving the current user
          if (normalizedFrom === normalizedCurrentUser) {
            // Current user sent to someone else - update the recipient's received amount
            if (userStats[to]) {
              userStats[to].received += amountNum
              if (
                !userStats[to].lastTransaction ||
                transactionDate > userStats[to].lastTransaction
              ) {
                userStats[to].lastTransaction = transactionDate
              }
              console.log(
                `Current user sent to ${to}: +$${amountNum} (received)`
              )
            }
          } else {
            // Someone else sent to current user - update the sender's sent amount
            if (userStats[from]) {
              userStats[from].sent += amountNum
              if (
                !userStats[from].lastTransaction ||
                transactionDate > userStats[from].lastTransaction
              ) {
                userStats[from].lastTransaction = transactionDate
              }
              console.log(`${from} sent to current user: +$${amountNum} (sent)`)
            }
          }
        } else {
          // This is a transaction between two other users
          // Update sent amount for sender
          if (userStats[from]) {
            userStats[from].sent += amountNum
            if (
              !userStats[from].lastTransaction ||
              transactionDate > userStats[from].lastTransaction
            ) {
              userStats[from].lastTransaction = transactionDate
            }
            console.log(`Updated ${from} sent: ${userStats[from].sent}`)
          }

          // Update received amount for recipient
          if (userStats[to]) {
            userStats[to].received += amountNum
            if (
              !userStats[to].lastTransaction ||
              transactionDate > userStats[to].lastTransaction
            ) {
              userStats[to].lastTransaction = transactionDate
            }
            console.log(`Updated ${to} received: ${userStats[to].received}`)
          }
        }
      })

      console.log("Final user stats:", userStats)

      // Convert to array and add username for sorting
      const usersArray = Object.entries(userStats).map(([username, stats]) => [
        username,
        { ...stats, username },
      ])

      // Sort users using the current sort settings
      const sortedUsers = sortUsers(usersArray)

      console.log("Sorted users:", sortedUsers)

      if (sortedUsers.length === 0) {
        userTableBody.innerHTML =
          '<div class="no-data">No user data to display. Try entering your username above.</div>'
        return
      }

      userTableBody.innerHTML = sortedUsers
        .map(([username, stats]) => {
          const delta = stats.received - stats.sent

          return `
            <div class="table-row">
              <div class="table-cell">
                <span class="user-name">${username}</span>
              </div>
              <div class="table-cell">
                <span class="amount-received">$${stats.sent.toFixed(2)}</span>
              </div>
              <div class="table-cell">
                <span class="amount-sent">$${stats.received.toFixed(2)}</span>
              </div>
              <div class="table-cell">
                <span class="${
                  delta >= 0 ? "delta-positive" : "delta-negative"
                }">
                  ${delta >= 0 ? "+" : ""}$${delta.toFixed(2)}
                </span>
              </div>
            </div>
          `
        })
        .join("")

      // Add sorting listeners after table is rendered
      setTimeout(() => {
        addSortingListeners()
        updateSortArrows()
      }, 100)
    })
  }

  function startScraping() {
    if (isScraping) return

    // Get page limit from input
    const pageLimit = parseInt(pageLimitInput.value) || 20

    // Validate page limit
    if (pageLimit < 1 || pageLimit > 500) {
      showError("Page limit must be between 1 and 500")
      return
    }

    isScraping = true
    scrapeButton.disabled = true
    refreshButton.disabled = true
    scrapeButton.textContent = "Scraping..."
    progressContainer.classList.remove("hidden")
    statusDiv.classList.add("hidden")

    // Send message to content script to start scraping with page limit
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          type: "START_SCRAPING",
          pageLimit: pageLimit,
          incremental: false,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            showError("Please navigate to luckybird.io first")
            resetScraping()
          }
        }
      )
    })
  }

  function refreshData() {
    if (isScraping) return

    // Get page limit from input
    const pageLimit = parseInt(pageLimitInput.value) || 20

    // Validate page limit
    if (pageLimit < 1 || pageLimit > 500) {
      showError("Page limit must be between 1 and 500")
      return
    }

    isScraping = true
    scrapeButton.disabled = true
    refreshButton.disabled = true
    refreshButton.textContent = "Refreshing..."
    progressContainer.classList.remove("hidden")
    statusDiv.classList.add("hidden")

    // Send message to content script to start incremental scraping
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          type: "START_SCRAPING",
          pageLimit: pageLimit,
          incremental: true,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            showError("Please navigate to luckybird.io first")
            resetScraping()
          }
        }
      )
    })
  }

  function updateProgress(progress, message) {
    progressBar.style.width = `${progress}%`
    progressText.textContent = message
  }

  function scrapingComplete(data) {
    resetScraping()

    if (data.incremental) {
      const message =
        data.newTransactionsCount > 0
          ? `Refresh complete! Found ${data.newTransactionsCount} new transactions.`
          : "Refresh complete! No new transactions found."
      showSuccess(message)
    } else {
      showSuccess(
        `Scraping complete! Found ${data.transactions.length} transactions.`
      )
    }

    loadData()
  }

  function resetScraping() {
    isScraping = false
    scrapeButton.disabled = false
    scrapeButton.textContent = "Start Scraping Tips"
    refreshButton.textContent = "🔄 Refresh Data"
    progressContainer.classList.add("hidden")

    // Refresh button state will be updated by loadData()
    loadData()
  }

  function showSuccess(message) {
    statusDiv.className = "status success"
    statusDiv.textContent = message
    statusDiv.classList.remove("hidden")
    setTimeout(() => statusDiv.classList.add("hidden"), 3000)
  }

  function showError(message) {
    statusDiv.className = "status error"
    statusDiv.textContent = message
    statusDiv.classList.remove("hidden")
    resetScraping()
  }

  function clearData() {
    if (confirm("Are you sure you want to clear all tip data?")) {
      chrome.storage.local.clear(() => {
        showSuccess("Data cleared successfully")
        loadData()
      })
    }
  }

  function exportData(format) {
    chrome.storage.local.get(["tipTransactions", "userBalances"], (result) => {
      const transactions = result.tipTransactions || []
      const userBalances = result.userBalances || {}

      if (transactions.length === 0) {
        showError("No data to export")
        return
      }

      let data, filename, mimeType

      if (format === "csv") {
        data = exportToCSV(transactions, userBalances)
        filename = `tip_tracker_${new Date().toISOString().split("T")[0]}.csv`
        mimeType = "text/csv"
      } else {
        data = JSON.stringify(
          {
            transactions,
            userBalances,
            exportDate: new Date().toISOString(),
          },
          null,
          2
        )
        filename = `tip_tracker_${new Date().toISOString().split("T")[0]}.json`
        mimeType = "application/json"
      }

      const blob = new Blob([data], { type: mimeType })
      const url = URL.createObjectURL(blob)

      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()

      URL.revokeObjectURL(url)
      showSuccess(`Data exported as ${filename}`)
    })
  }

  function exportToCSV(transactions, userBalances) {
    let csv = "Transaction Type,From,To,Amount,Currency,Date,Timestamp\n"

    transactions.forEach((tx) => {
      const date = new Date(tx.timestamp).toLocaleString()
      csv += `Tip,${tx.from || ""},${tx.to || ""},${tx.amount || ""},${
        tx.currency || "SC"
      },${date},${tx.timestamp}\n`
    })

    csv += "\n\nUser Balances\n"
    csv += "Username,Balance\n"

    Object.entries(userBalances).forEach(([username, balance]) => {
      csv += `${username},${balance.toFixed(2)}\n`
    })

    return csv
  }
})
