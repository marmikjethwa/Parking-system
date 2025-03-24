let currentVendor = null;
let chargesModal;
let billModal;

// Initialize modals
function initializeModals() {
    billModal = new bootstrap.Modal(document.getElementById('billModal'));
    chargesModal = new bootstrap.Modal(document.getElementById('chargesModal'));
}

const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');

// Toggle between login and register forms
document.getElementById('showRegister').addEventListener('click', () => {
  loginForm.style.display = 'none';
  registerForm.style.display = 'block';
});

document.getElementById('showLogin').addEventListener('click', () => {
  registerForm.style.display = 'none';
  loginForm.style.display = 'block';
});

// Login form submission
document.getElementById('login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const recaptchaResponse = grecaptcha.getResponse();
    if (!recaptchaResponse) {
        alert("Please complete the reCAPTCHA.");
        return;
    }
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, recaptchaResponse })
        });
        const data = await response.json();

        if (data.success) {
            currentVendor = data.vendor;
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('dashboard').style.display = 'block';
          
            if (currentVendor.entry_charge !== null) {
                document.getElementById('entryCharge').value = currentVendor.entry_charge;
            }
            if (currentVendor.hourly_charge !== null) {
                document.getElementById('hourlyCharge').value = currentVendor.hourly_charge;
            }
            chargesModal.show();
        } else {
            alert('Invalid credentials');
        }          
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
});

// Register form submission
document.getElementById('register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
  
    try {
      const response = await fetch('api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password})
      });
  const data = await response.json();
      // If the response isn't JSON, catch the issue early
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${errorText}`);
      }
  
      
  
      if (data.success) {
        alert('Registration successful! Please log in.');
        // Show login form, hide register form
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
      } else {
        alert('Registration failed: ' + data.message);
      }
    } catch (error) {
      console.error('Registration failed:', error);
      alert('Registration failed: ' + error.message);
    }
  });

// Charges form submission
document.getElementById('chargesForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const entryCharge = parseFloat(document.getElementById('entryCharge').value);
    const hourlyCharge = parseFloat(document.getElementById('hourlyCharge').value);

    if (isNaN(entryCharge) || isNaN(hourlyCharge)) {
        alert('Please enter valid numbers for charges');
        return;
    }

    try {
        const response = await fetch('/api/update-charges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vendorId: currentVendor.id,
                entryCharge,
                hourlyCharge
            })
        });
        const data = await response.json();

        if (data.success) {
            currentVendor.entry_charge = entryCharge;
            currentVendor.hourly_charge = hourlyCharge;

            chargesModal.hide();
            document.getElementById('chargesForm').reset();
            alert('Charges updated successfully!');
            loadParkingData();
        } else {
            alert('Failed to update charges: ' + data.message);
        }
    } catch (error) {
        alert('Failed to update charges: ' + error.message);
        console.error('Update charges error:', error);
    }
});

// New vehicle entry form submission
document.getElementById('entryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
        lotNumber: document.getElementById('lotNumber').value,
        carNumber: document.getElementById('carNumber').value,
        carName: document.getElementById('carName').value,
        mobileNumber: document.getElementById('mobileNumber').value
    };

    try {
        const response = await fetch('/api/vehicle-entry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const data = await response.json();

        if (data.success) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('newEntryModal'));
            modal.hide();
            document.getElementById('entryForm').reset();
            loadParkingData();
        }
    } catch (error) {
        alert('Failed to add vehicle: ' + error.message);
    }
});

// Load parking data
async function loadParkingData() {
    try {
        const response = await fetch('/api/parking-lot');
        const data = await response.json();

        if (data.success) {
            const tbody = document.getElementById('parkingData');
            tbody.innerHTML = '';

            data.entries.forEach(entry => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${entry.lot_number}</td>
                    <td>${entry.car_number}</td>
                    <td>${entry.car_name}</td>
                    <td>${entry.mobile_number}</td>
                    <td>${new Date(entry.entry_time).toLocaleString()}</td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="exitVehicle(${entry.id})">
                            Exit Vehicle
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        alert('Failed to load parking data: ' + error.message);
    }
}

// Exit vehicle
async function exitVehicle(entryId) {
    if (!confirm('Are you sure you want to exit this vehicle?')) {
        return;
    }

    try {
        const response = await fetch('/api/vehicle-exit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryId })
        });
        const data = await response.json();

        if (data.success) {
            const bill = data.bill;

            // Update bill content
            document.getElementById('billContent').innerHTML = `
                <div class="bill-details p-3">
                    <h1 text-allign:center>QuickPark</h1>
                    <h4 class="text-center mb-4">Parking Bill</h4>
                    <div class="border-bottom mb-3">
                        <p><strong>Car Number:</strong> ${bill.car_number}</p>
                        <p><strong>Car Name:</strong> ${bill.car_name}</p>
                        <p><strong>Mobile Number:</strong> ${bill.mobile_number}</p>
                    </div>
                    <div class="mb-3">
                        <p><strong>Entry Time:</strong> ${new Date(bill.entry_time).toLocaleString()}</p>
                        <p><strong>Exit Time:</strong> ${new Date(bill.exit_time).toLocaleString()}</p>
                    </div>
                    <div class="border-top pt-3">
                        <p><strong>Fixed Charge:</strong> ₹${bill.fixed_charge}</p>
                        <p><strong>Hourly Charge:</strong> ₹${bill.hourly_charge} × ${bill.total_hours} hours</p>
                        <p class="h5 mt-2"><strong>Total Amount:</strong> ₹${bill.total_amount}</p>
                    </div>
                </div>
            `;

            // Show the modal
            billModal.show();

            // Refresh parking data
            loadParkingData();
        } else {
            alert('Failed to process vehicle exit: ' + data.message);
        }
    } catch (error) {
        alert('Failed to exit vehicle: ' + error.message);
        console.error('Exit vehicle error:', error);
    }
}

// Print bill
document.getElementById('printBill').addEventListener('click', () => {
    const printContents = document.getElementById('billContent').innerHTML;
    
    const printWindow = window.open('', '', 'width=600,height=600');
    printWindow.document.write(`
        <html>
        <head>
            <title>Print Bill</title>
            <style>
                body { font-family: Arial, sans-serif; }
                .bill-container { padding: 20px; border: 1px solid #000; }
            </style>
        </head>
        <body>
            <div class="bill-container">${printContents}</div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(() => window.close(), 500);
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
});


// Search by lot number
document.getElementById('searchLot').addEventListener('click', async () => {
    const lotNumber = document.getElementById('lotSearch').value;
    try {
        const response = await fetch(`/api/search-lot/${lotNumber}`);
        const data = await response.json();

        if (data.success) {
            const tbody = document.getElementById('parkingData');
            tbody.innerHTML = '';

            data.entries.forEach(entry => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${entry.lot_number}</td>
                    <td>${entry.car_number}</td>
                    <td>${entry.car_name}</td>
                    <td>${entry.mobile_number}</td>
                    <td>${new Date(entry.entry_time).toLocaleString()}</td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="exitVehicle(${entry.id})">
                            Exit Vehicle
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        alert('Search failed: ' + error.message);
    }
});

// Search by car number
document.getElementById('searchCar').addEventListener('click', async () => {
    const carNumber = document.getElementById('carSearch').value;
    try {
        const response = await fetch(`/api/search-car/${carNumber}`);
        const data = await response.json();

        if (data.success) {
            const tbody = document.getElementById('parkingData');
            tbody.innerHTML = '';

            data.entries.forEach(entry => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${entry.lot_number}</td>
                    <td>${entry.car_number}</td>
                    <td>${entry.car_name}</td>
                    <td>${entry.mobile_number}</td>
                    <td>${new Date(entry.entry_time).toLocaleString()}</td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="exitVehicle(${entry.id})">
                            Exit Vehicle
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        alert('Search failed: ' + error.message);
    }
});

// View parking lot
document.getElementById('viewParkingLot').addEventListener('click', loadParkingData);

// Initialize modals on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeModals();
    if (currentVendor) {
        loadParkingData();
    }
});
