# 🌡️⚡ TP-Link + Govee Thermostat Automation  
**Automate heat lamps, terrariums, or appliances based on Govee thermometer readings using TP-Link smart plugs.**  

*Perfect for reptile tanks, seed germination, or wine cellars!*  

---

## 📋 Features  
- **Temperature-triggered automation** – Turn TP-Link plugs on/off based on Govee thermometer readings.  
- **Precise control** – Define custom thresholds with `>`, `<`, `≥`, or `≤` comparators.  
- **Multi-plug support** – Manage multiple devices per thermometer (e.g., heat lamp + fan).  
- **Hysteresis-safe** – Built-in buffer between thresholds to prevent rapid cycling.  
- **Local execution** – No cloud dependencies; runs on your machine (Raspberry Pi friendly).  

---

## ⚙️ Configuration  
### **1. Edit `config.json`**  
```json
{
  "mac_addr": "e1:3d:05:c6:41:87",
  "name": "Bo's Thermometer",
  "plugs_managed": [
    {
      "name": "Basking Lamp",
      "mac_addr": "BC-07-1D-2C-33-EB",
      "conditions": [
        {
          "type": "turn_off",
          "when": { "key": "tempInF", "comparator": "gte", "value": "88" }
        },
        {
          "type": "turn_on",
          "when": { "key": "tempInF", "comparator": "lt", "value": "85" }
        }
      ]
    }
  ]
}
```

### **2. Key Fields Explained**  
| Field           | Description                                                                 |
|-----------------|-----------------------------------------------------------------------------|
| `mac_addr`      | Govee thermometer MAC address (find in your Govee app).                    |
| `plugs_managed` | Array of TP-Link plugs to control.                                         |
| `conditions`    | Rules for each plug: `turn_on`/`turn_off` based on `tempInF` or `tempInC`. |
| `comparator`    | **`"gte"`** (≥), **`"gt"`** (>), **`"lt"`** (<), or **`"lte"`** (≤).      |

---

## 🚀 Installation  
1. **Clone the repo**:  
   ```bash
   git clone https://github.com/nidhhoggr/tplink-govee.git
   cd tplink-govee
   ```

2. **Install dependencies**:  
   ```bash
   npm install
   ```

3. **Run the script**:  
   ```bash
   node index.js
   ```

4. **(Optional) Run as a background service**:  
   Use `pm2` or `systemd` for 24/7 operation (e.g., on a Raspberry Pi).  

---

## 🦎 Example Use Case: Reptile Basking Zone  
| Temperature | Action                      | Result                      |
|-------------|-----------------------------|-----------------------------|
| **≥88°F**   | `turn_off` the lamp         | Prevents overheating.       |
| **<85°F**   | `turn_on` the lamp          | Maintains basking temp.     |
| **86°F**    | No action                   | Stable "safe zone".         |

---

## ❓ FAQ  
### **Q: How do I find my Govee thermometer's MAC address?**  
A: Open the Govee app → Device Settings → Hardware Info.  

### **Q: Can I use Celsius instead of Fahrenheit?**  
A: Yes! Replace `"key": "tempInF"` with `"key": "tempInC"` in conditions.  

### **Q: Why is there a 3°F gap between thresholds?**  
A: This prevents the plug from rapidly toggling if the temperature fluctuates near a single threshold.  

---

## 📜 License  
MIT © [nidhhoggr](https://github.com/nidhhoggr)  

---

## 🔧 Need Help?  
Open an issue or contribute! PRs welcome for:  
- **Humidity control** (if your Govee supports it).  
- **Home Assistant integration**.  
- **More comparators** (e.g., time-based rules).  

--- 
