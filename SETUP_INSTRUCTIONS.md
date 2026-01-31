# Setup Instructions

This document provides step-by-step instructions to complete the setup of your FDIC bank data pipeline.

## ✅ Completed Steps

1. ✓ Python 3.9.6 is installed
2. ✓ pip is installed and working
3. ✓ Virtual environment created (`venv/`)
4. ✓ All Python dependencies installed
5. ✓ Git repository initialized
6. ✓ Initial commit made
7. ✓ Configuration files created

## 🔧 Remaining Steps

### Step 1: Install PostgreSQL

PostgreSQL is not currently installed. Choose one of these methods:

#### Option A: Install via Homebrew (Recommended for macOS)

1. **Install Homebrew** (if not already installed):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   Follow the on-screen instructions. You may need to enter your password.

2. **Install PostgreSQL**:
   ```bash
   brew install postgresql@15
   ```

3. **Start PostgreSQL service**:
   ```bash
   brew services start postgresql@15
   ```

4. **Create the database**:
   ```bash
   createdb fdic
   ```

5. **Set a password for the postgres user** (optional but recommended):
   ```bash
   psql postgres
   ```
   Then in the psql prompt:
   ```sql
   ALTER USER postgres WITH PASSWORD 'your_password';
   \q
   ```

#### Option B: Install PostgreSQL.app (Easier GUI option)

1. Download PostgreSQL.app from: https://postgresapp.com/
2. Install and launch the app
3. Click "Initialize" to create a new server
4. Open Terminal and add PostgreSQL to your PATH:
   ```bash
   sudo mkdir -p /etc/paths.d &&
   echo /Applications/Postgres.app/Contents/Versions/latest/bin | sudo tee /etc/paths.d/postgresapp
   ```
5. Restart Terminal
6. Create the database:
   ```bash
   createdb fdic
   ```

### Step 2: Configure Database Connection

1. **Copy the example config file**:
   ```bash
   cp config.example.py config.py
   ```

2. **Edit `config.py`** with your PostgreSQL credentials:
   ```python
   DB_CONFIG = {
       'dbname': 'fdic',
       'user': 'postgres',  # or your PostgreSQL username
       'password': 'your_actual_password',  # Change this!
       'host': 'localhost',
       'port': '5432'
   }
   ```

   **Note:** `config.py` is in `.gitignore` and won't be committed to Git.

### Step 3: Create GitHub Repository

Since GitHub CLI is not installed, follow these steps:

1. **Go to GitHub.com** and sign in
2. **Click the "+" icon** in the top right → "New repository"
3. **Repository settings**:
   - Name: `bank-fdic-v1` (or your preferred name)
   - Description: "FDIC bank data pipeline with PostgreSQL integration"
   - Visibility: Public or Private (your choice)
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
4. **Click "Create repository"**

5. **Connect your local repository to GitHub**:
   ```bash
   cd /Users/bharathishekar/coding/cursor/bank-fdic/bank-fdic-v1
   git remote add origin https://github.com/YOUR_USERNAME/bank-fdic-v1.git
   git branch -M main
   git push -u origin main
   ```

   Replace `YOUR_USERNAME` with your actual GitHub username.

   If you use SSH instead of HTTPS:
   ```bash
   git remote add origin git@github.com:YOUR_USERNAME/bank-fdic-v1.git
   git branch -M main
   git push -u origin main
   ```

### Step 4: Test the Pipeline

1. **Activate your virtual environment**:
   ```bash
   source venv/bin/activate
   ```

2. **Run the initial data load**:
   ```bash
   python fdic_to_postgres.py
   ```

   This will:
   - Create all database tables
   - Fetch all active institutions (~4,000+ banks)
   - Fetch last 2 years of financial data
   - Insert everything into PostgreSQL

   **Expected runtime:** 5-15 minutes

3. **Verify the data**:
   ```bash
   psql fdic -c "SELECT COUNT(*) FROM institutions;"
   psql fdic -c "SELECT COUNT(*) FROM financials;"
   ```

### Step 5: (Optional) Configure Git Identity

If you want to set your Git name and email:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## Troubleshooting

### PostgreSQL Connection Issues

- **"Connection refused"**: Make sure PostgreSQL is running
  - Homebrew: `brew services list` (should show postgresql@15 as started)
  - PostgreSQL.app: Make sure the app is running
- **"Password authentication failed"**: Check your password in `config.py`
- **"Database does not exist"**: Run `createdb fdic`

### Python Import Errors

- Make sure virtual environment is activated: `source venv/bin/activate`
- Reinstall dependencies: `pip install -r requirements.txt`

### API Issues

- Test the API directly: `curl "https://banks.data.fdic.gov/api/institutions?limit=5&format=json"`
- Check your internet connection
- The FDIC API is free and doesn't require authentication (though API key is recommended)

## Next Steps

Once everything is set up:

1. **Explore the data** with SQL queries (see README.md for examples)
2. **Set up incremental updates** using `fdic_incremental_pipeline.py`
3. **Schedule regular updates** using cron (macOS/Linux) or Task Scheduler (Windows)
4. **Build analytics** on top of the data

## Need Help?

- Check the main README.md for detailed documentation
- Review QUICKSTART.md for quick reference
- See fdic_api_guide.md for API details
- Check logs in `fdic_pipeline.log` if the pipeline fails
