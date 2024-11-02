// IndexedDB setup
let dbPromise = indexedDB.open("moneyManagerDB", 2);

dbPromise.onupgradeneeded = (event) => {
    const db = event.target.result;

    if (!db.objectStoreNames.contains("users")) {
        const userStore = db.createObjectStore("users", { keyPath: "username" });
    }

    if (!db.objectStoreNames.contains("dailyExpenses")) {
        const expenseStore = db.createObjectStore("dailyExpenses", { keyPath: "id", autoIncrement: true });
        expenseStore.createIndex("user", "user", { unique: false });
        expenseStore.createIndex("category", "category", { unique: false });
    }
};
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }, (err) => {
          console.log('ServiceWorker registration failed: ', err);
        });
    });
  }
  


// Global variable for current user
let currentUser = null;

// Handle Sign-Up
document.getElementById("signup-form")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const username = document.getElementById("new-username").value;
    const password = document.getElementById("new-password").value;

    const dbTransaction = dbPromise.result.transaction("users", "readwrite");
    const userStore = dbTransaction.objectStore("users");

    userStore.add({ username: username, password: password }).onsuccess = () => {
        alert("Account created successfully! Please login.");
        window.location.href = "index.html";
    };

    dbTransaction.onerror = () => {
        alert("Username already exists.");
    };
});

// Set currentUser on successful login
document.getElementById("login-form")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const dbTransaction = dbPromise.result.transaction("users", "readonly");
    const userStore = dbTransaction.objectStore("users");

    userStore.get(username).onsuccess = (event) => {
        const user = event.target.result;
        if (user && user.password === password) {
            currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user)); // Save in localStorage
            window.location.href = "profile.html";
        } else {
            alert("Invalid username or password.");
        }
    };
});

// Load currentUser from localStorage in profile page
if (window.location.pathname.includes("profile.html")) {
    currentUser = JSON.parse(localStorage.getItem('currentUser'));
    document.getElementById("profile-username").innerText = currentUser?.username || "Guest";
}


document.getElementById("expense-form")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const amount = document.getElementById("amount").value;
    const paymentMethod = document.getElementById("payment-method").value;
    const category = document.getElementById("category").value;
    const expenseDate = document.getElementById("expense-date").value || new Date().toLocaleDateString(); // Default to today if not selected
    let finalCategory = category;

    // Check if the 'Other' category is selected and get the custom text
    if (category === "Other") {
        const otherCategoryText = document.getElementById("other-category").value;
        if (otherCategoryText.trim() === "") {
            alert("Please specify the category for 'Other'.");
            return;
        }
        finalCategory = otherCategoryText; // Use the custom category text
    }

    const expense = {
        user: currentUser.username,
        amount: parseFloat(amount),
        paymentMethod: paymentMethod,
        category: finalCategory,
        date: expenseDate
    };

    const dbTransaction = dbPromise.result.transaction("dailyExpenses", "readwrite");
    const store = dbTransaction.objectStore("dailyExpenses");
    store.add(expense);

    dbTransaction.oncomplete = () => {
        alert("Expense added successfully!");
        generateReport(); // Refresh the report
    };
});
// Helper function to compare if two dates are on the same day
function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

// View expenses based on the selected period (daily, weekly, monthly, yearly)
function viewExpenses(period) {
    const dbTransaction = dbPromise.result.transaction("dailyExpenses", "readonly");
    const store = dbTransaction.objectStore("dailyExpenses");
    const now = new Date();
    const expenses = [];

    store.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            const expense = cursor.value;
            const expenseDate = new Date(expense.date);

            let valid = false;
            if (period === "daily") {
                valid = isSameDay(expenseDate, now);  // Using the isSameDay function here
            } else if (period === "weekly") {
                const oneWeekAgo = new Date(now.setDate(now.getDate() - 7));
                valid = expenseDate >= oneWeekAgo;
            } else if (period === "monthly") {
                const oneMonthAgo = new Date(now.setMonth(now.getMonth() - 1));
                valid = expenseDate >= oneMonthAgo;
            } else if (period === "yearly") {
                const oneYearAgo = new Date(now.setFullYear(now.getFullYear() - 1));
                valid = expenseDate >= oneYearAgo;
            }

            if (valid) {
                expenses.push(expense);
            }
            cursor.continue();
        } else {
            populateExpensesTable(expenses);
        }
    };
}


// Show/hide the custom "Other" category input based on selection
document.getElementById("category").addEventListener("change", function() {
    const otherCategoryContainer = document.getElementById("other-category-container");
    if (this.value === "Other") {
        otherCategoryContainer.style.display = "block";
    } else {
        otherCategoryContainer.style.display = "none";
    }
});


function generateWeeklyReport() {
    const dbTransaction = dbPromise.result.transaction("dailyExpenses", "readonly");
    const store = dbTransaction.objectStore("dailyExpenses");

    const categoryTotals = {};
    const now = new Date();
    const oneWeekAgo = new Date(now.setDate(now.getDate() - 7));

    store.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            const expense = cursor.value;
            const expenseDate = new Date(expense.date);

            if (expenseDate >= oneWeekAgo) {
                if (!categoryTotals[expense.category]) {
                    categoryTotals[expense.category] = [];
                }
                categoryTotals[expense.category].push(expense.amount);
            }
            cursor.continue();
        } else {
            // Process Report
            let report = "Weekly Report:\n\n";
            for (const category in categoryTotals) {
                const amounts = categoryTotals[category];
                const maxSpent = Math.max(...amounts);
                const minSpent = Math.min(...amounts);
                report += `${category} - Max: ${maxSpent}, Min: ${minSpent}\n`;
            }
            alert(report);
        }
    };
}

document.getElementById('generate-weekly-report')?.addEventListener('click', generateWeeklyReport);


// Generate CSV for Weekly Expenses
document.getElementById('download-weekly-csv')?.addEventListener('click', () => {
    generateCSV('week');
});

// Generate CSV for Monthly Expenses
document.getElementById('download-monthly-csv')?.addEventListener('click', () => {
    generateCSV('month');
});

// Generate CSV function
// Generate CSV function for 'week', 'month', or 'year' periods
function generateCSV(period) {
    const dbTransaction = dbPromise.result.transaction("dailyExpenses", "readonly");
    const store = dbTransaction.objectStore("dailyExpenses");
    const expenses = [];
    let totalSpent = 0;

    store.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            const expense = cursor.value;
            const expenseDate = new Date(expense.date);
            const now = new Date();

            let valid = false;
            if (period === 'week') {
                const oneWeekAgo = new Date(now.setDate(now.getDate() - 7));
                valid = expenseDate >= oneWeekAgo;
            } else if (period === 'month') {
                const oneMonthAgo = new Date(now.setMonth(now.getMonth() - 1));
                valid = expenseDate >= oneMonthAgo;
            } else if (period === 'year') {
                const oneYearAgo = new Date(now.setFullYear(now.getFullYear() - 1));
                valid = expenseDate >= oneYearAgo;
            }

            if (valid) {
                expenses.push(expense);
                totalSpent += expense.amount; // Calculate total spent
            }
            cursor.continue();
        } else {
            // Generate CSV
            let csvContent = "data:text/csv;charset=utf-8,Date,Amount,Payment Method,Category\n";
            expenses.forEach(exp => {
                csvContent += `${exp.date},${exp.amount},${exp.paymentMethod},${exp.category}\n`;
            });

            // Append total money spent at the end of the CSV
            csvContent += `\nTotal Money Spent,${totalSpent.toFixed(2)}\n`;

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `${period}-expenses-${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link); // Required for FF

            link.click();
            document.body.removeChild(link);
        }
    };
}

document.getElementById("view-expenses-btn")?.addEventListener("click", () => {
    const period = document.getElementById("view-period").value;
    viewExpenses(period);
});

// View expenses based on the selected period (daily, weekly, monthly, yearly)
function viewExpenses(period) {
    const dbTransaction = dbPromise.result.transaction("dailyExpenses", "readonly");
    const store = dbTransaction.objectStore("dailyExpenses");
    const now = new Date();
    const expenses = [];

    store.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            const expense = cursor.value;
            const expenseDate = new Date(expense.date);

            let valid = false;
            if (period === "daily") {
                valid = expenseDate.toDateString() === now.toDateString(); // Check if it's today
            } else if (period === "weekly") {
                const oneWeekAgo = new Date(now);
                oneWeekAgo.setDate(now.getDate() - 7);
                valid = expenseDate >= oneWeekAgo; // Check if within last 7 days
            } else if (period === "monthly") {
                const oneMonthAgo = new Date(now);
                oneMonthAgo.setMonth(now.getMonth() - 1);
                valid = expenseDate >= oneMonthAgo; // Check if within last month
            } else if (period === "yearly") {
                const oneYearAgo = new Date(now);
                oneYearAgo.setFullYear(now.getFullYear() - 1);
                valid = expenseDate >= oneYearAgo; // Check if within last year
            }

            if (valid) {
                expenses.push(expense); // Add valid expense to array
            }
            cursor.continue(); // Continue to the next cursor
        } else {
            populateExpensesTable(expenses); // Populate table when done
        }
    };
}

// Populate the expenses table with Edit and Delete functionality
function populateExpensesTable(expenses) {
    const tableBody = document.getElementById("expenses-table").getElementsByTagName("tbody")[0];
    tableBody.innerHTML = ""; // Clear existing rows

    expenses.forEach(exp => {
        const row = tableBody.insertRow();
        row.insertCell(0).innerText = new Date(exp.date).toLocaleDateString(); // Format date
        row.insertCell(1).innerText = exp.amount.toFixed(2); // Format amount
        row.insertCell(2).innerText = exp.paymentMethod;
        row.insertCell(3).innerText = exp.category;

        // Add Edit and Delete buttons
        const editBtn = document.createElement("button");
        editBtn.innerText = "Edit";
        editBtn.addEventListener("click", () => editExpense(exp));
        row.insertCell(4).appendChild(editBtn);

        const deleteBtn = document.createElement("button");
        deleteBtn.innerText = "Delete";
        deleteBtn.addEventListener("click", () => deleteExpense(exp.id));
        row.insertCell(5).appendChild(deleteBtn);
    });
}

// Edit expense function
function editExpense(expense) {
    const newAmount = prompt("Edit amount:", expense.amount);
    const newPaymentMethod = prompt("Edit payment method:", expense.paymentMethod);
    const newCategory = prompt("Edit category:", expense.category);
    const newDate = prompt("Edit date (YYYY-MM-DD):", new Date(expense.date).toISOString().split('T')[0]); // Format to YYYY-MM-DD

    if (newAmount !== null && newPaymentMethod !== null && newCategory !== null && newDate !== null) {
        const dbTransaction = dbPromise.result.transaction("dailyExpenses", "readwrite");
        const store = dbTransaction.objectStore("dailyExpenses");

        // Update expense object with new values
        expense.amount = parseFloat(newAmount);
        expense.paymentMethod = newPaymentMethod;
        expense.category = newCategory;
        expense.date = newDate;

        // Update the expense in the database
        store.put(expense).onsuccess = () => {
            alert("Expense updated successfully!");
            viewExpenses(document.getElementById("view-period").value); // Refresh view
        };
    }
}

// Delete expense function
function deleteExpense(expenseId) {
    if (confirm("Are you sure you want to delete this expense?")) {
        const dbTransaction = dbPromise.result.transaction("dailyExpenses", "readwrite");
        const store = dbTransaction.objectStore("dailyExpenses");

        // Delete the expense from the database
        store.delete(expenseId).onsuccess = () => {
            alert("Expense deleted successfully!");
            viewExpenses(document.getElementById("view-period").value); // Refresh view
        };
    }
}

function generateMonthlyReport() {
    const dbTransaction = dbPromise.result.transaction("dailyExpenses", "readonly");
    const store = dbTransaction.objectStore("dailyExpenses");

    const categoryTotals = {};
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    let totalSpent = 0;

    store.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            const expense = cursor.value;
            const expenseDate = new Date(expense.date);
            const expenseMonth = expenseDate.getMonth();
            const expenseYear = expenseDate.getFullYear();

            // Check if expense is from the current month and year
            if (expenseMonth === currentMonth && expenseYear === currentYear) {
                totalSpent += expense.amount;
                if (!categoryTotals[expense.category]) {
                    categoryTotals[expense.category] = 0;
                }
                categoryTotals[expense.category] += expense.amount;
            }
            cursor.continue();
        } else {
            // After gathering all expenses, create a report
            let report = `Monthly Report for ${now.toLocaleString('default', { month: 'long' })} ${currentYear}:\n\n`;
            report += `Total Money Spent: $${totalSpent.toFixed(2)}\n\n`;
            report += "Category-wise Spending:\n";

            for (const category in categoryTotals) {
                report += `${category}: $${categoryTotals[category].toFixed(2)}\n`;
            }

            // Insights for data analysis
            report += "\nData Analysis Points:\n";
            if (totalSpent > 0) {
                const maxCategory = Object.keys(categoryTotals).reduce((a, b) => categoryTotals[a] > categoryTotals[b] ? a : b);
                const minCategory = Object.keys(categoryTotals).reduce((a, b) => categoryTotals[a] < categoryTotals[b] ? a : b);
                report += `- Highest spending category: ${maxCategory} ($${categoryTotals[maxCategory].toFixed(2)})\n`;
                report += `- Lowest spending category: ${minCategory} ($${categoryTotals[minCategory].toFixed(2)})\n`;
            } else {
                report += "- No expenses recorded this month.\n";
            }

            alert(report);
            generateMonthlyCSV(categoryTotals, totalSpent);
        }
    };
}

// Generate CSV for Monthly Report with total money spent in the month
function generateMonthlyCSV(categoryTotals, totalSpent) {
    let csvContent = "data:text/csv;charset=utf-8,Category,Amount\n";
    
    // Add category-wise spending to CSV
    for (const category in categoryTotals) {
        csvContent += `${category},${categoryTotals[category].toFixed(2)}\n`;
    }

    // Append total money spent in the month
    csvContent += `\nTotal Money Spent,${totalSpent.toFixed(2)}\n`;

    // Encode the CSV content and trigger download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `monthly-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); // Required for Firefox

    link.click();
    document.body.removeChild(link);
}


// Button to trigger monthly report generation
document.getElementById("generate-monthly-report")?.addEventListener("click", generateMonthlyReport);

// Handle Logout
document.getElementById("logout-btn")?.addEventListener("click", () => {
    window.location.href = "index.html";
});
