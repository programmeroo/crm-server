# pi-server
CRM for home use.



To use Python bridge:
// Example: Run a python script from a button click in your CRM
const { exec } = require('child_process');

app.post('/run-sync', (req, res) => {
    exec('python3 /home/andys/scripts/daily_sync.py', (error, stdout, stderr) => {
        if (error) return res.status(500).send(error.message);
        res.send('Sync Complete');
    });
});
