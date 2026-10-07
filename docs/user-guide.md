# User guide — how to use the HomeOps AI demo

The demo is a household operations agent: you describe a problem at home, it triages safety, plans,
researches current options and asks you to confirm anything that would contact someone outside your home.

Live demo: **https://homeops.novatechsystem.co.uk**

## 1. Start

Open the site and press **🎙 Talk to the agent**, or pick one of the eight example cards on the home page.
Every card deep-links into the console with the scenario already loaded.

## 2. Say or type the problem

You are not limited to the examples. Anything about a home works:

| Say something like | What the agent does |
|---|---|
| "The boiler is making a loud humming noise and guests arrive on Saturday" | Boiler plan: Gas Safe engineer, service visit, what to watch for |
| "There is no hot water and the radiators are cold, my elderly mother lives with us" | Heating plan with the vulnerable-occupant rule applied |
| "Water is dripping under the kitchen sink" | Plumbing plan: plumber, isolation valve, contain the damage |
| "The socket sparked and smells burnt" | Electrical plan + emergency-style safety guidance |
| "The washing machine will not drain" | Appliance plan: repairer, switch off, drain the drum |
| "The fridge is not getting cold and food arrives tomorrow" | Appliance plan with a deadline |

**Voice:** press the blue **Speak** button, allow the microphone when the browser asks, and talk normally.
While it listens you will see the words appear in the box. Press the button again to stop.

- Works in **Chrome, Edge and Safari**. Firefox does not implement speech recognition — type instead.
- If you blocked the microphone earlier, unlock it in the address bar and press Speak again.
- Recognition runs in the browser vendor's cloud, so it needs an internet connection.

**Spoken replies:** on by default. Press **🔊 Voice replies on** in the header to silence them.

## 3. Answer at most two questions

The agent asks only what changes the plan (for example: is there any smell of gas?). Answer in the two
boxes and press **Send answers**. One round of clarification, never an interrogation.

## 4. Read the plan card

| Element | Meaning |
|---|---|
| Urgency badge | emergency / urgent / needs attention / monitor — decided by deterministic rules, never lowered by the model |
| Safety guidance box | Human-written instructions. For gas: leave, do not switch anything, call 0800 111 999 |
| Actions | What to do, why, who owns it, and when it is due |
| "Waiting for your confirmation" | Actions that would contact a third party. Nothing happens until you approve |
| Sources | Current public pages used, with the URL and retrieval time |

Use **Assign to…** to give an action to a household member (a confirmation dialog appears) and
**Mark done** to tick it off. Both only change records inside this demo: nobody is called, nothing is booked.

## 5. Come back later

- **Did we fix it?** in the console answers from the stored plan.
- **Open plan page** gives a link that survives a reload or a new browser session.
- **New conversation** starts fresh while the plan stays stored — the cross-session context the Alexa+
  experience is built on.

## 6. What the agent trace shows (Agent trace tab)

Steps in order, each with a status and a duration: intake, deterministic triage, model planning
(NVIDIA Nemotron on Nebius), Tavily research, persistence, confirmation. Model time and research time are
totalled, and failed steps are counted. No raw prompts and no chain-of-thought are ever shown.

## 7. Home upkeep (recurring jobs)

The **Home upkeep** panel keeps the jobs that come back: the monthly alarm test, the annual boiler
service, the gutters before winter.

| What you see | What it means |
|---|---|
| "overdue by 12 days" | The due date has passed. |
| "due today" / "due in 9 days" | Due now or inside the next fortnight. |
| "scheduled" | Comfortably in the future; nothing to do yet. |
| **Mark done** | Asks for confirmation, records today as the last completion, and moves the next due date forward by the cadence (monthly, every 3, 6 or 12 months). |
| **Add reminder** | Creates a recurring task with the cadence you pick; it becomes due immediately unless you set a date. |

Ask the agent **"What needs doing at home?"** in the console: it answers from the stored list and reads the
answer out loud when spoken replies are on. Voice clients get the same through the MCP tool
`get_maintenance_due`.

## 8. Repair evidence (photos, voice notes, notes)

Every action in a plan can carry proof:

- **Photo** - the leak, the error code on the display, the finished repair. JPEG metadata (including GPS
  location) is stripped before the bytes are stored.
- **Voice note** - what the engineer said, recorded in the browser.
- **Note** - a line of text: the part number, the quote, what was agreed.

Attachments appear under the action with a thumbnail or player, and the plan header shows how many are
attached. **Remove** deletes the row and the file. Nothing is uploaded anywhere else: attachments live on the
same server as the plan, and deleting the demo data deletes them too.

## 9. Trust and limits

- Demo data is synthetic: a fictional household in Bristol. Delete it with **Delete demo data**.
- Every fact sourced from research keeps its URL and retrieval time; prices and availability are never invented.
- HomeOps AI is a coordinator, not a diagnostic or emergency service. In an emergency, call 999.

