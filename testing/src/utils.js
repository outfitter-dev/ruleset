// Utility Functions
// CONTEXT LABEL: 🟨 JavaScript (testing/src/utils.js)

function formatDate(date) {
  return date.toISOString();
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = { formatDate, capitalize };
