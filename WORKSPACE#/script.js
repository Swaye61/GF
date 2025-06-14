javascript
document.getElementById('appointmentForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const name = document.getElementById('name').value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;

    const confirmationMessage = `Appointment scheduled for ${name} on ${date} at ${time}.`;
    document.getElementById('confirmationMessage').innerText = confirmationMessage;

    // Clear the form fields
    this.reset();
});