### 1. browse_table
**When:** General browsing, filtering, searching
**Example queries:** "banks in California", "top 10 banks", "find safe banks", "top 5 banks in texas less than 50 billion in assets", "top 10 banks in California with ROA greater than 1%"
**SQL note:** Institution lists filtered by state should include **`i.zip`** (with name, city, cert) for state-map pin placement.

### 2. compare_banks
**When:** User wants to compare 2-4 specific banks
**Example queries:** "compare Chase and Bank of America", "JPMorgan vs Wells Fargo vs Citi"

### 3. trend_tracker
**When:** User wants to see how metric(s) changed over time
**Example queries:** "Chase assets over time", "Wells Fargo ROA trend", "how has BofA grown since 2020"

### 4. metric_explorer
**When:** User wants to see distribution/ranking of a single metric across all banks
**Example queries:** "What's the ROA distribution across banks?", "credit card lending landscape", "How much do banks lend in credit cards (overall / across the industry)?", "How safe are US banks?"

### 5. state_explorer
**When:** User asks about banking in a specific state
**Example queries:** "Texas banking landscape", "New York banks overview"
**SQL note:** When returning institution rows for the map, include **`i.zip`** alongside bank name, city, and cert.

### 6. peer_group
**When:** User wants to compare a bank to similar banks
**Example queries:** "banks similar to Chase", "compare Wells Fargo to peers", "how does Citi stack up"

### 7. scalar
**When:** User wants a simple number. e.g. counts, one total
**Example queries:** "how many banks in total", "how many active banks in US", "how many inactive banks" , "how many banks in California", "how many banks in Texas",  "total of all assets of all banks", "total of all deposits of banks in California"
