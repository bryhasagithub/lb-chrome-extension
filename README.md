# LB Tip Tracker Extension

### WORK IN PROGRESS 
A Chrome extension to track and analyze tip transactions  Features

- **Automatic Data Collection**: Scrapes tip transaction data from the LuckyBird.io website
- **User Balance Tracking**: Calculates net balances between you and other users
- **Pagination Support**: Automatically navigates through all transaction pages
- **Data Export**: Export data to CSV or JSON format
- **Real-time Statistics**: View total tips, net balance, and user counts

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `tip-tracker-extension` folder
4. The extension should now appear in your extensions list

## Usage

1. **Navigate to LuckyBird.io**: Go to the LuckyBird.io website in your browser
2. **Open the Extension**: Click on the Tip Tracker extension icon in your browser toolbar
3. **Start Scraping**: Click "Start Scraping Tips" to begin collecting transaction data
4. **View Results**: The extension will show:
   - Total number of tips found
   - Your net balance across all users
   - Number of unique users you've interacted with
   - Individual user balances (positive = they owe you, negative = you owe them)

## How It Works

The extension automatically:

1. Clicks the "Buy" button to open the store modal
2. Navigates to the "Tips" tab
3. Clicks on "Tips Transactions" to view the transaction history
4. Scrapes data from each page of transactions
5. Navigates through all available pages using pagination
6. Calculates user balances based on tip amounts

## Data Structure

Each transaction includes:

- **From**: Username who sent the tip
- **To**: Username who received the tip
- **Amount**: Tip amount
- **Currency**: Currency type (Gold Coins, SC, etc.)
- **Date**: Transaction date and time
- **Timestamp**: Unix timestamp for sorting

## Export Options

- **CSV Export**: Creates a spreadsheet-compatible file with transaction data and user balances
- **JSON Export**: Creates a structured JSON file with all data for programmatic use

## Troubleshooting

- **"Please navigate to luckybird.io first"**: Make sure you're on the LuckyBird.io website before starting the scraping process
- **No data found**: Ensure you have tip transactions in your account and that the site structure hasn't changed
- **Scraping stops early**: The extension has a safety limit of 50 pages to prevent infinite loops

## Technical Details

- **Manifest Version**: 3 (Chrome Extension Manifest V3)
- **Permissions**: Storage, Active Tab, Scripting
- **Host Permissions**: All URLs (for maximum compatibility)
- **Content Script**: Runs on all pages to detect when you're on LuckyBird.io

## Currency Conversion

The extension converts Gold Coins to USD using a default rate of $0.0001 per Gold Coin. This can be adjusted in the `calculateUserBalances` function in `content.js` if needed.

## Privacy

- All data is stored locally in your browser
- No data is sent to external servers
- You can clear all data using the "Clear Data" button

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Ensure you're on the correct website
3. Try refreshing the page and running the scraper again
4. Check that the site structure hasn't changed significantly
