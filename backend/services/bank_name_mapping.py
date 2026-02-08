"""
Bank name mapping: Common/casual names to official FDIC names
Used to help LLM convert user queries to correct SQL queries
"""

# Mapping of common/casual bank names to official FDIC names
# Multiple variations can map to the same official name
BANK_NAME_MAPPING = {
    # JPMorgan Chase
    "jp morgan": "JPMorgan Chase",
    "jpmorgan": "JPMorgan Chase",
    "jpm": "JPMorgan Chase",
    "chase": "JPMorgan Chase",
    "chase bank": "JPMorgan Chase",
    "jpmorgan chase": "JPMorgan Chase",
    "j.p. morgan": "JPMorgan Chase",
    "j p morgan": "JPMorgan Chase",
    
    # Bank of America
    "bank of america": "Bank of America",
    "bofa": "Bank of America",
    "boa": "Bank of America",
    "b of a": "Bank of America",
    "bank of a": "Bank of America",
    
    # Wells Fargo
    "wells fargo": "Wells Fargo",
    "wells": "Wells Fargo",
    "wf": "Wells Fargo",
    
    # Citibank
    "citibank": "Citibank",
    "citi": "Citibank",
    "citigroup": "Citibank",
    
    # U.S. Bank
    "us bank": "U.S. Bank",
    "usbank": "U.S. Bank",
    "u.s. bank": "U.S. Bank",
    "usb": "U.S. Bank",
    
    # PNC Bank
    "pnc": "PNC Bank",
    "pnc bank": "PNC Bank",
    
    # Truist Bank
    "truist": "Truist Bank",
    "truist bank": "Truist Bank",
    "bb&t": "Truist Bank",
    "bbt": "Truist Bank",
    "suntrust": "Truist Bank",
    "sun trust": "Truist Bank",
    
    # Capital One
    "capital one": "Capital One",
    "cap one": "Capital One",
    "capitalone": "Capital One",
    
    # TD Bank
    "td bank": "TD Bank",
    "toronto dominion": "TD Bank",
    "td": "TD Bank",
    
    # Bank of New York Mellon
    "bny mellon": "Bank of New York Mellon",
    "bank of new york": "Bank of New York Mellon",
    "bny": "Bank of New York Mellon",
    "mellon": "Bank of New York Mellon",
    
    # State Street
    "state street": "State Street",
    "statestreet": "State Street",
    
    # Goldman Sachs
    "goldman sachs": "Goldman Sachs",
    "goldman": "Goldman Sachs",
    "gs": "Goldman Sachs",
    
    # Morgan Stanley
    "morgan stanley": "Morgan Stanley",
    "ms": "Morgan Stanley",
    
    # Charles Schwab
    "charles schwab": "Charles Schwab",
    "schwab": "Charles Schwab",
    
    # Ally Bank
    "ally": "Ally Bank",
    "ally bank": "Ally Bank",
    "gmac": "Ally Bank",
    
    # Discover Bank
    "discover": "Discover Bank",
    "discover bank": "Discover Bank",
    
    # American Express
    "american express": "American Express",
    "amex": "American Express",
    "americanexpress": "American Express",
    
    # Regions Bank
    "regions": "Regions Bank",
    "regions bank": "Regions Bank",
    
    # Fifth Third Bank
    "fifth third": "Fifth Third Bank",
    "5/3": "Fifth Third Bank",
    "53": "Fifth Third Bank",
    "fifththird": "Fifth Third Bank",
    
    # KeyBank
    "keybank": "KeyBank",
    "key bank": "KeyBank",
    "key": "KeyBank",
    
    # Huntington Bank
    "huntington": "Huntington Bank",
    "huntington bank": "Huntington Bank",
    
    # Citizens Bank
    "citizens": "Citizens Bank",
    "citizens bank": "Citizens Bank",
    
    # M&T Bank
    "m&t": "M&T Bank",
    "m and t": "M&T Bank",
    "mt bank": "M&T Bank",
    
    # First Republic (now part of JPMorgan)
    "first republic": "First Republic Bank",
    "firstrepublic": "First Republic Bank",
    
    # Silicon Valley Bank (now part of First Citizens)
    "svb": "Silicon Valley Bank",
    "silicon valley": "Silicon Valley Bank",
    
    # Signature Bank
    "signature": "Signature Bank",
    "signature bank": "Signature Bank",
    
    # First Citizens
    "first citizens": "First Citizens Bank",
    "firstcitizens": "First Citizens Bank",
    
    # Zions Bank
    "zions": "Zions Bank",
    "zions bank": "Zions Bank",
    
    # Comerica
    "comerica": "Comerica Bank",
    "comerica bank": "Comerica Bank",
    
    # First Horizon
    "first horizon": "First Horizon Bank",
    "firsthorizon": "First Horizon Bank",
    
    # New York Community Bank
    "nycb": "New York Community Bank",
    "new york community": "New York Community Bank",
    
    # East West Bank
    "east west": "East West Bank",
    "eastwest": "East West Bank",
    
    # Popular Bank
    "popular": "Popular Bank",
    "popular bank": "Popular Bank",
    "banco popular": "Popular Bank",
    
    # Webster Bank
    "webster": "Webster Bank",
    "webster bank": "Webster Bank",
    
    # Valley National Bank
    "valley national": "Valley National Bank",
    "valleynational": "Valley National Bank",
    
    # Associated Bank
    "associated": "Associated Bank",
    "associated bank": "Associated Bank",
    
    # Old National Bank
    "old national": "Old National Bank",
    "oldnational": "Old National Bank",
    
    # First National Bank
    "first national": "First National Bank",
    "firstnational": "First National Bank",
    "fnb": "First National Bank",
    
    # Pinnacle Bank
    "pinnacle": "Pinnacle Bank",
    "pinnacle bank": "Pinnacle Bank",
    
    # Wintrust
    "wintrust": "Wintrust Financial",
    "wintrust financial": "Wintrust Financial",
    
    # First Interstate Bank
    "first interstate": "First Interstate Bank",
    "firstinterstate": "First Interstate Bank",
    
    # UMB Bank
    "umb": "UMB Bank",
    "umb bank": "UMB Bank",
    
    # BOK Financial
    "bok": "BOK Financial",
    "bok financial": "BOK Financial",
    
    # First Hawaiian Bank
    "first hawaiian": "First Hawaiian Bank",
    "firsthawaiian": "First Hawaiian Bank",
    
    # Bank of Hawaii
    "bank of hawaii": "Bank of Hawaii",
    "boh": "Bank of Hawaii",
    
    # Central Pacific Bank
    "central pacific": "Central Pacific Bank",
    "centralpacific": "Central Pacific Bank",
    
    # American Savings Bank
    "american savings": "American Savings Bank",
    "americansavings": "American Savings Bank",
    
    # First Hawaiian
    "fhb": "First Hawaiian Bank",
    
    # Additional common variations
    "jpmorgan chase bank": "JPMorgan Chase",
    "jpmorgan chase bank national association": "JPMorgan Chase",
    "wells fargo bank": "Wells Fargo",
    "wells fargo bank national association": "Wells Fargo",
    "bank of america national association": "Bank of America",
    "citibank national association": "Citibank",
    "us bank national association": "U.S. Bank",
}


def get_bank_name_mapping_text() -> str:
    """
    Format bank name mapping as text for LLM prompt
    
    Returns:
        Formatted string with bank name mappings
    """
    # Group by official name to show all variations
    official_to_variations = {}
    for variation, official in BANK_NAME_MAPPING.items():
        if official not in official_to_variations:
            official_to_variations[official] = []
        official_to_variations[official].append(variation)
    
    # Format as text
    text = "Bank Name Mapping (Common/Casual Names → Official FDIC Names):\n"
    text += "When users mention banks by casual names, use these mappings to find the official name:\n\n"
    
    for official, variations in sorted(official_to_variations.items()):
        variations_str = ", ".join([f'"{v}"' for v in sorted(set(variations))])
        text += f"  {variations_str} → \"{official}\"\n"
    
    return text


def get_bank_name_instructions() -> str:
    """
    Get instructions for LLM on how to use bank name mapping
    
    Returns:
        Instructions string
    """
    return """
IMPORTANT: Bank Name Matching Instructions:

1. When users mention banks by casual/common names (e.g., "JP Morgan", "Chase", "BofA"), 
   FIRST look up the official FDIC name using the Bank Name Mapping above.

2. Use ILIKE with wildcards for fuzzy matching in SQL:
   - Example: If user says "JP Morgan", use: WHERE name ILIKE '%JPMorgan Chase%'
   - Example: If user says "Wells Fargo", use: WHERE name ILIKE '%Wells Fargo%'
   - Example: If user says "BofA", use: WHERE name ILIKE '%Bank of America%'

3. Always use ILIKE (case-insensitive) with % wildcards on both sides for maximum matching:
   - Correct: WHERE name ILIKE '%JPMorgan Chase%'
   - Incorrect: WHERE name = 'JPMorgan Chase' (too strict, may miss variations)

4. The official FDIC names may include suffixes like "National Association", "N.A.", etc.
   Using ILIKE with % wildcards will match these variations automatically.

5. If a bank name is not in the mapping, still use ILIKE with % wildcards to match partial names.

Examples:
- User: "assets of JP Morgan" 
  → SQL: SELECT ... WHERE name ILIKE '%JPMorgan Chase%'
  
- User: "Wells Fargo deposits"
  → SQL: SELECT ... WHERE name ILIKE '%Wells Fargo%'
  
- User: "BofA ROA"
  → SQL: SELECT ... WHERE name ILIKE '%Bank of America%'
"""
