# 🚀 Quick Start Guide - Local Testing

## Instant Setup (< 2 minutes)

### 1. Start the Server
Open your terminal and run:
```bash
cd /Users/pep/Documents/avaluatron
python3 server.py
```

You should see:
```
============================================================
  AVALUATRÓ - Local Development Server
============================================================

  🚀 Server running at: http://localhost:3000
  📁 Project root: /Users/pep/Documents/avaluatron
  🔍 Mock Supabase: Enabled
  📝 Logging: Enabled
  ...
```

### 2. Open in Browser
Visit: **http://localhost:3000**

### 3. Test the App
- Create a class group: `2n ESO A`
- Add students: `Maria`, `Joan`, `Carla`
- Create a subject: `Matemàtiques`
- Add a rubric
- Create an activity
- Grade a student
- Refresh the page → data should still be there ✅

### 4. Run Tests
In browser console (F12), run:
```javascript
const runner = new TestRunner();
runner.runAll();
```

Or visit: **http://localhost:3000/?test=true**

## Browser Console Quick Tests

### Check Local Storage
```javascript
// View all data
const data = JSON.parse(localStorage.getItem('avaluatro.data.v1'));
console.log(data);

// Check number of students
console.log(`Students: ${data.students.length}`);

// Check number of assessments
console.log(`Assessments: ${data.assessments.length}`);
```

### Clear Data (Start Fresh)
```javascript
localStorage.clear();
location.reload();
```

### View Specific Data
```javascript
const data = JSON.parse(localStorage.getItem('avaluatro.data.v1'));

// Students
console.table(data.students);

// Class groups
console.table(data.classGroups);

// Subjects
console.table(data.subjects);
```

## Stop the Server

Press `Ctrl+C` in the terminal where the server is running.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Connection refused" | Make sure server is running (see step 1) |
| Blank page | Press F5 to refresh, check DevTools (F12) console for errors |
| Data not saving | Check if browser is in private mode (disables localStorage) |
| Port 3000 in use | Run `PORT=3001 python3 server.py` to use port 3001 |

## Next Steps

1. **Review Architecture**: Read [INSTITUTIONAL_LAYER.md](INSTITUTIONAL_LAYER.md)
2. **Full Testing Guide**: See [LOCAL_TESTING.md](LOCAL_TESTING.md)
3. **Run Test Suite**: Execute comprehensive tests with `TestRunner`
4. **Cloud Integration**: Setup Supabase (see documentation)

## Important Files

- **server.py** - Local development server
- **app.js** - Main application logic
- **index.html** - Page structure
- **styles.css** - Main styling
- **styles-institutional.css** - Institutional layer styles
- **js/institutional.js** - Institutional manager logic
- **js/institutional-ui.js** - Institutional UI components

## Features Available Now

✅ Create class groups and students
✅ Create subjects with rubrics
✅ Create activities with assessments
✅ Grade student evidence
✅ Local data persistence
✅ Export/import JSON
✅ Multi-teacher preparation (UI structure ready)
✅ Institutional schema (ready to deploy to Supabase)

## Coming Soon

🔜 Email verification flow
🔜 Cloud workspace sync
🔜 Institutional dashboard
🔜 Teacher collaboration on rubrics
🔜 Institutional reporting
🔜 Student/parent portals

---

**Ready? Open terminal and run:** `cd /Users/pep/Documents/avaluatron && python3 server.py`
