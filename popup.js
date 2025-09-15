// Popup script for Tip Tracker extension
document.addEventListener("DOMContentLoaded", function () {
  // Force close any open modals immediately
  const modal = document.getElementById("transactionModal")
  if (modal) {
    console.log("Force hiding modal on page load")
    modal.classList.add("hidden")
    modal.style.display = "none"
  }
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

  // Modal elements
  const transactionModal = document.getElementById("transactionModal")
  const modalTitle = document.getElementById("modalTitle")
  const transactionList = document.getElementById("transactionList")
  const closeModal = document.getElementById("closeModal")

  // Search elements
  const userSearchInput = document.getElementById("userSearch")
  const clearSearchButton = document.getElementById("clearSearch")
  const searchResultsInfo = document.getElementById("searchResultsInfo")

  // Stats elements
  const totalTipsEl = document.getElementById("totalTips")
  const waitingOnEl = document.getElementById("waitingOn")
  const usersCountEl = document.getElementById("usersCount")
  const tipsOwedEl = document.getElementById("tipsOwed")

  let isScraping = false
  let currentSort = { column: "delta", direction: "desc" } // Default sort by delta descending
  let currentSearchTerm = "" // Track current search term

  // Helper function to get excluded users list
  function getExcludedUsers() {
    const excludeUsersText = excludeUsersInput.value.trim()
    if (!excludeUsersText) return []

    return excludeUsersText
      .split(",")
      .map((username) => username.trim().toLowerCase())
      .filter((username) => username.length > 0)
  }

  // Helper function to get current user(s) list
  function getCurrentUsers() {
    const currentUserText = currentUserInput.value.trim()
    if (!currentUserText) return []

    return currentUserText
      .split(",")
      .map((username) => username.trim())
      .filter((username) => username.length > 0)
  }

  // Helper function to check if a username matches any of the current users
  function isCurrentUser(username) {
    const currentUsers = getCurrentUsers()
    if (currentUsers.length === 0) return false

    const normalizedUsername = username.toLowerCase().trim()
    return currentUsers.some(
      (currentUser) => currentUser.toLowerCase().trim() === normalizedUsername
    )
  }

  // Ensure modal starts hidden immediately
  transactionModal.classList.add("hidden")
  transactionModal.style.display = "none"

  // Load and display current data
  loadData()

  // Initialize search UI
  updateSearchUI()

  // Force hide modal after a short delay to ensure it's hidden
  setTimeout(() => {
    console.log("Final check - ensuring modal is hidden")
    transactionModal.classList.add("hidden")
    transactionModal.style.display = "none"
  }, 100)

  // Load current user(s) and exclude users from storage
  chrome.storage.local.get(["currentUser", "excludeUsers"], (result) => {
    if (result.currentUser) {
      // Handle both single username (legacy) and multiple usernames
      if (Array.isArray(result.currentUser)) {
        currentUserInput.value = result.currentUser.join(", ")
      } else {
        currentUserInput.value = result.currentUser
      }
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
  closeModal.addEventListener("click", closeTransactionModal)

  // Search event listeners
  userSearchInput.addEventListener("input", handleUserSearch)
  clearSearchButton.addEventListener("click", clearUserSearch)

  // Close modal when clicking outside of it
  transactionModal.addEventListener("click", (e) => {
    console.log("Modal clicked, target:", e.target)
    if (e.target === transactionModal) {
      closeTransactionModal()
    }
  })

  // Prevent scroll propagation on modal content
  transactionModal.addEventListener("wheel", (e) => {
    e.stopPropagation()
  })

  // Add debugging to see if modal is being shown unexpectedly
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "class"
      ) {
        console.log("Modal class changed:", transactionModal.className)
        if (!transactionModal.classList.contains("hidden")) {
          console.log("Modal is visible - this might be unexpected!")
        }
      }
    })
  })

  observer.observe(transactionModal, { attributes: true })

  // Save username(s) when changed
  currentUserInput.addEventListener("blur", () => {
    const usernames = getCurrentUsers()
    if (usernames.length > 0) {
      chrome.storage.local.set({ currentUser: usernames })
      console.log("Username(s) saved:", usernames)
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

    // Get current user(s) from storage
    chrome.storage.local.get(["currentUser"], (result) => {
      let currentUsers = []
      if (result.currentUser) {
        if (Array.isArray(result.currentUser)) {
          currentUsers = result.currentUser
        } else {
          currentUsers = [result.currentUser]
        }
      } else {
        currentUsers = getCurrentUsers()
      }
      console.log("Current user(s) for stats calculation:", currentUsers)

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

      // Initialize user stats for all users except current user(s) and excluded users
      allUsers.forEach((username) => {
        const normalizedUsername = username.toLowerCase().trim()

        // Skip current user(s)
        if (currentUsers.length > 0 && isCurrentUser(username)) {
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

        // Skip if both users are current users
        if (
          currentUsers.length > 0 &&
          isCurrentUser(from) &&
          isCurrentUser(to)
        ) {
          return
        }

        // Process transactions involving current user(s)
        if (
          currentUsers.length > 0 &&
          (isCurrentUser(from) || isCurrentUser(to))
        ) {
          if (isCurrentUser(from)) {
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

    // Get current user(s) for calculations
    chrome.storage.local.get(["currentUser"], (result) => {
      let currentUsers = []
      if (result.currentUser) {
        if (Array.isArray(result.currentUser)) {
          currentUsers = result.currentUser
        } else {
          currentUsers = [result.currentUser]
        }
      } else {
        currentUsers = getCurrentUsers()
      }
      console.log("Current user(s) for table:", currentUsers)
      console.log("Current user input value:", currentUserInput.value)
      console.log("Stored current user(s):", result.currentUser)

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

      // Initialize user stats for all users except current user(s) and excluded users
      allUsers.forEach((username) => {
        const normalizedUsername = username.toLowerCase().trim()

        // Skip current user(s) if we know who they are
        if (currentUsers.length > 0 && isCurrentUser(username)) {
          console.log(`Skipping current user: ${username}`)
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
          currentUsers,
        })

        // Skip if both users are current users (shouldn't happen)
        if (
          currentUsers.length > 0 &&
          isCurrentUser(from) &&
          isCurrentUser(to)
        ) {
          console.log("Skipping self-to-self transaction")
          return
        }

        // Process transactions involving current user(s) differently
        if (
          currentUsers.length > 0 &&
          (isCurrentUser(from) || isCurrentUser(to))
        ) {
          // This is a transaction involving the current user(s)
          if (isCurrentUser(from)) {
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
      let usersArray = Object.entries(userStats).map(([username, stats]) => [
        username,
        { ...stats, username },
      ])

      // Apply search filter if there's a search term
      if (currentSearchTerm.trim()) {
        const searchTerm = currentSearchTerm.toLowerCase().trim()
        usersArray = usersArray.filter(([username, stats]) =>
          username.toLowerCase().includes(searchTerm)
        )
      }

      // Sort users using the current sort settings
      const sortedUsers = sortUsers(usersArray)

      // Update search results count
      const totalUsers = Object.keys(userStats).length
      updateSearchResultsCount(sortedUsers.length, totalUsers)

      console.log("Sorted users:", sortedUsers)

      if (sortedUsers.length === 0) {
        if (currentSearchTerm.trim()) {
          userTableBody.innerHTML =
            '<div class="no-data">No users found matching your search. Try a different search term.</div>'
        } else {
          userTableBody.innerHTML =
            '<div class="no-data">No user data to display. Try entering your username above.</div>'
        }
        return
      }

      userTableBody.innerHTML = sortedUsers
        .map(([username, stats]) => {
          const delta = stats.received - stats.sent

          return `
            <div class="table-row">
              <div class="table-cell">
                <span class="user-name" data-username="${username}">${username}</span>
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
        addUserClickListeners()
      }, 100)
    })
  }

  function startScraping() {
    if (isScraping) return

    // Get page limit from input
    const pageLimit = parseInt(pageLimitInput.value) || 20

    // Validate page limit
    if (pageLimit < 1 || pageLimit > 1000) {
      showError("Page limit must be between 1 and 1000")
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
    if (pageLimit < 1 || pageLimit > 1000) {
      showError("Page limit must be between 1 and 1000")
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
      let message
      if (data.newTransactionsCount > 0) {
        if (data.lastNewTransactionDate) {
          const lastDate = new Date(
            data.lastNewTransactionDate
          ).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
          message = `Refresh complete! Found ${data.newTransactionsCount} new transactions up until ${lastDate}.`
        } else {
          message = `Refresh complete! Found ${data.newTransactionsCount} new transactions.`
        }
      } else {
        message = "Refresh complete! No new transactions found."
      }
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

  // Modal functions
  function addUserClickListeners() {
    console.log("Adding click listeners to user names")
    const userNames = document.querySelectorAll(".user-name[data-username]")
    console.log("Found user names:", userNames.length)
    userNames.forEach((userName) => {
      userName.addEventListener("click", (e) => {
        e.preventDefault()
        e.stopPropagation()
        const username = e.target.getAttribute("data-username")
        console.log("User name clicked:", username)
        showTransactionModal(username)
      })
    })
  }

  function showTransactionModal(username) {
    if (!username) {
      console.log("No username provided, not opening modal")
      return
    }
    console.log("Opening transaction modal for user:", username)
    // Get current user(s) and transactions
    chrome.storage.local.get(["tipTransactions", "currentUser"], (result) => {
      const transactions = result.tipTransactions || []
      let currentUsers = []
      if (result.currentUser) {
        if (Array.isArray(result.currentUser)) {
          currentUsers = result.currentUser
        } else {
          currentUsers = [result.currentUser]
        }
      } else {
        currentUsers = getCurrentUsers()
      }

      // Filter transactions between current user(s) and selected user
      const userTransactions = transactions.filter((tx) => {
        const normalizedUsername = username.toLowerCase().trim()
        const normalizedFrom = tx.from.toLowerCase().trim()
        const normalizedTo = tx.to.toLowerCase().trim()

        return (
          (isCurrentUser(tx.from) && normalizedTo === normalizedUsername) ||
          (isCurrentUser(tx.to) && normalizedFrom === normalizedUsername)
        )
      })

      // Sort by timestamp (newest first)
      userTransactions.sort((a, b) => b.timestamp - a.timestamp)

      // Update modal title
      modalTitle.textContent = `Transactions with ${username}`

      // Calculate summary stats
      let totalSent = 0
      let totalReceived = 0

      userTransactions.forEach((tx) => {
        if (isCurrentUser(tx.from)) {
          totalSent += tx.amount
        } else {
          totalReceived += tx.amount
        }
      })

      const netAmount = totalReceived - totalSent

      // Render modal content
      if (userTransactions.length === 0) {
        transactionList.innerHTML =
          '<div class="no-transactions">No transactions found with this user.</div>'
      } else {
        transactionList.innerHTML = `
          <div class="transaction-summary">
            <h4>Summary</h4>
            <div class="summary-stats">
              <div class="summary-stat">
                <div class="summary-stat-value">$${totalSent.toFixed(2)}</div>
                <div class="summary-stat-label">You Sent</div>
              </div>
              <div class="summary-stat">
                <div class="summary-stat-value">$${totalReceived.toFixed(
                  2
                )}</div>
                <div class="summary-stat-label">You Received</div>
              </div>
            </div>
            <div style="margin-top: 10px; font-size: 14px; color: var(--lb-white);">
              Net: <span style="color: ${
                netAmount >= 0 ? "var(--lb-green)" : "var(--lb-red)"
              }">
                ${netAmount >= 0 ? "+" : ""}$${netAmount.toFixed(2)}
              </span>
            </div>
          </div>
          ${userTransactions
            .map((tx) => {
              const isSent = isCurrentUser(tx.from)
              const direction = isSent ? "sent" : "received"
              const otherUser = isSent ? tx.to : tx.from
              const date = new Date(tx.timestamp).toLocaleString()
              const formattedDate = new Date(tx.timestamp)
                .toLocaleString("en-US", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })
                .replace(",", "")

              return `
              <div class="transaction-item" data-transaction='${JSON.stringify(
                tx
              )}'>
                <div class="transaction-info">
                  <div class="transaction-direction ${direction}" data-copy="${
                tx.from
              } -> ${tx.to} ${tx.amount} ${formattedDate}">
                    ${
                      isSent
                        ? `Sent to ${otherUser}`
                        : `Received from ${otherUser}`
                    }
                  </div>
                  <div class="transaction-date" data-copy="${tx.from} -> ${
                tx.to
              } ${tx.amount} ${formattedDate}">${date}</div>
                </div>
                <div class="transaction-amount" data-copy="${tx.from} -> ${
                tx.to
              } ${tx.amount} ${formattedDate}">$${tx.amount.toFixed(2)}</div>
              </div>
            `
            })
            .join("")}
        `
      }

      // Show modal
      transactionModal.classList.remove("hidden")
      transactionModal.style.display = "flex"

      // Add click listeners to transaction cells for clipboard copying
      addTransactionCellClickListeners()

      // Prevent background scrolling
      document.body.style.overflow = "hidden"
    })
  }

  function addTransactionCellClickListeners() {
    // Add click listeners to all elements with data-copy attribute
    const copyableElements = document.querySelectorAll("[data-copy]")
    copyableElements.forEach((element) => {
      element.style.cursor = "pointer"
      element.addEventListener("click", async (e) => {
        e.preventDefault()
        e.stopPropagation()

        const copyText = element.getAttribute("data-copy")
        try {
          await navigator.clipboard.writeText(copyText)

          // Show visual feedback
          const originalText = element.textContent
          element.textContent = "Copied!"
          element.style.color = "var(--lb-green)"

          setTimeout(() => {
            element.textContent = originalText
            element.style.color = ""
          }, 1000)

          console.log("Copied to clipboard:", copyText)
        } catch (err) {
          console.error("Failed to copy to clipboard:", err)
          // Fallback for older browsers
          const textArea = document.createElement("textarea")
          textArea.value = copyText
          document.body.appendChild(textArea)
          textArea.select()
          document.execCommand("copy")
          document.body.removeChild(textArea)

          // Show visual feedback
          const originalText = element.textContent
          element.textContent = "Copied!"
          element.style.color = "var(--lb-green)"

          setTimeout(() => {
            element.textContent = originalText
            element.style.color = ""
          }, 1000)
        }
      })
    })
  }

  function closeTransactionModal() {
    console.log("Closing transaction modal")
    transactionModal.classList.add("hidden")
    transactionModal.style.display = "none"

    // Restore background scrolling
    document.body.style.overflow = "auto"
  }

  // Search functions
  function handleUserSearch(e) {
    currentSearchTerm = e.target.value
    updateSearchUI()

    // Re-render the user list with the new search term
    chrome.storage.local.get(["tipTransactions", "userBalances"], (result) => {
      const transactions = result.tipTransactions || []
      const userBalances = result.userBalances || {}
      updateUserList(transactions, userBalances)
    })
  }

  function clearUserSearch() {
    userSearchInput.value = ""
    currentSearchTerm = ""
    updateSearchUI()

    // Re-render the user list without search filter
    chrome.storage.local.get(["tipTransactions", "userBalances"], (result) => {
      const transactions = result.tipTransactions || []
      const userBalances = result.userBalances || {}
      updateUserList(transactions, userBalances)
    })
  }

  function updateSearchUI() {
    // Update clear button visibility
    if (currentSearchTerm.trim()) {
      clearSearchButton.classList.remove("hidden")
    } else {
      clearSearchButton.classList.add("hidden")
    }

    // Update search results info
    if (currentSearchTerm.trim()) {
      searchResultsInfo.classList.remove("hidden")
      // We'll update the count in updateUserList
    } else {
      searchResultsInfo.classList.add("hidden")
    }
  }

  function updateSearchResultsCount(filteredCount, totalCount) {
    if (currentSearchTerm.trim()) {
      searchResultsInfo.textContent = `Showing ${filteredCount} of ${totalCount} users`
      searchResultsInfo.classList.remove("hidden")
    } else {
      searchResultsInfo.classList.add("hidden")
    }
  }
})
