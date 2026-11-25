# Local Testing Guide for Avaluatron Institutional Layer

## Quick Start

### Prerequisites
- Node.js 14+ (for the development server)
- macOS, Linux, or Windows
- A modern web browser (Chrome, Firefox, Safari, Edge)

### Setup

1. **Navigate to project directory**
   ```bash
   cd /Users/pep/Documents/avaluatron
   ```

2. **Install dependencies** (if not already done)
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   node server.js
   ```

   You should see output like:
   ```
   ============================================================
     AVALUATRÓ - Local Development Server
   ============================================================
   
     🚀 Server running at: http://localhost:3000
     📁 Project root: /Users/pep/Documents/avaluatron
     🔍 Mock Supabase: Enabled
     📝 Logging: Enabled
   
     Available routes:
       - http://localhost:3000/ (Main app)
       - http://localhost:3000/index.html (Explicit)
       - http://localhost:3000/rest/v1/* (Mock Supabase)
       - http://localhost:3000/auth/v1/* (Mock Auth)
   
   ============================================================
   ```

4. **Open in browser**
   - Visit: http://localhost:3000
   - You should see the Avaluatró interface

5. **Stop the server**
   - Press `Ctrl+C` in the terminal

## Testing Scenarios

### Scenario 1: Local-Only Teacher Mode

**Objective**: Verify teachers can work locally without email or cloud account

**Steps**:
1. Start the app at http://localhost:3000
2. Create a new class group (e.g., "2n ESO A")
3. Add students manually
4. Create a subject (e.g., "Matemàtiques")
5. Add a rubric for the subject
6. Create an activity with evidence collection
7. Grade a student's evidence
8. Verify data persists in browser localStorage
9. Refresh the page → data should still be there
10. Check browser DevTools → Application → Local Storage → avaluatro.data.v1

**Expected Result**: ✅ All data saved locally without any email requirement

### Scenario 2: Local-Only Teacher - Export/Import

**Objective**: Verify teachers can backup their local work

**Steps**:
1. Create some data (class group, students, subject, activity)
2. Click "Exporta JSON" button in top-right
3. Save the JSON file to your computer
4. Clear browser local storage (DevTools → Application → Local Storage → Clear All)
5. Refresh page → app should be empty
6. Click "Importa" button
7. Select the JSON file you saved
8. Verify all data is restored

**Expected Result**: ✅ Export/import works for local data backup

### Scenario 3: Institutional Layer UI Components

**Objective**: Verify institutional UI components render correctly

**Steps**:
1. Open browser console (F12 → Console tab)
2. Test institutional manager initialization:
   ```javascript
   // This would need to be manually tested since we're in local mode
   console.log("Institutional layer should be available via window.institutional");
   ```
3. Visual inspection:
   - Check that institutional CSS loads (no styling errors)
   - Verify color schemes match (purple gradients for institutional UI)
   - Check responsive design by resizing browser

**Expected Result**: ✅ No console errors, institutional styling available

### Scenario 4: Teacher Collaboration Feature Check

**Objective**: Verify collaborative multi-teacher features

**Steps**:
1. Navigate to Subjects view
2. Create a subject (e.g., "Science")
3. Check if rubric editing interface appears
4. Try to edit a rubric
5. Verify that the edit interface allows adding/modifying criteria
6. Check for teacher assignment UI (not yet functional in local mode)

**Expected Result**: ✅ Single teacher can edit rubrics locally

### Scenario 5: Browser DevTools Inspection

**Objective**: Verify local storage structure

**Steps**:
1. Create some test data:
   - 1 class group
   - 2 students
   - 1 subject
   - 1 activity
   - 1 grade entry

2. Open DevTools (F12)
3. Go to Application → Local Storage
4. Click on http://localhost:3000
5. Find `avaluatro.data.v1` entry
6. Inspect the JSON structure

**Expected Result**: ✅ 
```json
{
  "schemaVersion": 1,
  "students": [...],
  "classGroups": [...],
  "competencies": [...],
  "activities": [...],
  "subjects": [...],
  "dailyAssessments": [],
  "assessments": [...]
}
```

## Debugging Tips

### View Local Storage
```javascript
// In browser console:
const data = localStorage.getItem('avaluatro.data.v1');
console.log(JSON.parse(data));
```

### Clear All Local Data
```javascript
// In browser console:
localStorage.clear();
location.reload();
```

### View Current Data in Memory
```javascript
// In browser console (if imported):
console.log(window.data || "Data not loaded yet");
```

### Check Institutional Files Loaded
```javascript
// In browser console:
console.log("Checking for institutional manager...");
// Will show error if js/institutional.js not loaded
```

### Monitor Network Requests
1. Open DevTools (F12)
2. Go to Network tab
3. Reload page
4. Check for:
   - `index.html` - should load
   - `app.js` - should load
   - `styles.css` - should load
   - Other `.js` and `.css` files
5. Look for any 404 errors (red text)

## Common Issues & Solutions

### Issue: "Cannot find module" errors in console
**Solution**: Make sure all imported files exist. Check:
- js/data.js
- js/views.js
- js/state.js
- js/grades.js
- etc.

### Issue: Styles not loading properly
**Solution**:
1. Check Network tab for CSS file loads
2. Verify styles-institutional.css exists in project root
3. Clear browser cache: Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)

### Issue: Data not persisting after refresh
**Solution**:
1. Check localStorage in DevTools
2. Verify browser is not in private/incognito mode (localStorage disabled)
3. Check browser storage quota: usually 5-10MB available
4. Try exporting data as JSON as backup

### Issue: "localhost:3000 refused to connect"
**Solution**:
1. Verify server is running (should see startup message)
2. Check that port 3000 is not in use:
   ```bash
   lsof -i :3000
   ```
3. If port is in use, start server on different port:
   ```bash
   PORT=3001 node server.js
   ```

### Issue: Browser shows blank page
**Solution**:
1. Check DevTools Console for errors (F12)
2. Check Network tab for failed requests
3. Verify app.js is loading
4. Check index.html is accessible
5. Try hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)

## Testing Checklist

### Core Functionality
- [ ] App loads at http://localhost:3000
- [ ] No console errors on page load
- [ ] All navigation menu items visible
- [ ] Can create a class group
- [ ] Can add students to class group
- [ ] Can create a subject
- [ ] Can create a rubric for subject
- [ ] Can create an activity
- [ ] Can grade a student
- [ ] Data persists after page refresh
- [ ] Can export data to JSON
- [ ] Can import data from JSON

### Institutional Layer Components
- [ ] Institutional CSS loads without errors
- [ ] No "file not found" errors for institutional JS files
- [ ] Color scheme includes institutional purple gradients
- [ ] Multiple teachers can be assigned to subjects (UI prepared)
- [ ] Email verification status can be tracked (preparation)

### Browser Compatibility
- [ ] Works in Chrome/Chromium
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works in Edge
- [ ] Responsive on mobile (resize browser)

### Performance
- [ ] Page loads in < 3 seconds
- [ ] No significant lag when adding data
- [ ] Export/import completes quickly (< 1 second)
- [ ] No memory leaks (DevTools → Performance)

## Next Steps for Cloud Testing

Once institutional layer is integrated:

1. **Setup Supabase Project**
   ```bash
   # Install Supabase CLI
   npm install -g supabase
   
   # Login to Supabase
   supabase login
   
   # Create new project (or link existing)
   supabase projects create
   ```

2. **Deploy Schema**
   ```bash
   supabase db push
   ```

3. **Connect to Real Backend**
   - Update `app.js` to initialize Supabase client with real credentials
   - Test teacher sign-up and email verification
   - Test institutional workspace sync

4. **Email Verification Testing**
   - Use Supabase Auth email templates
   - Setup fake email service for testing
   - Test verification flow end-to-end

## Performance Profiling

To check app performance:

1. Open DevTools → Performance tab
2. Click "Record"
3. Perform action (create activity, grade student, etc.)
4. Click "Stop"
5. Analyze the flame chart for bottlenecks

Target metrics:
- Page load: < 2 seconds
- Action response: < 500ms
- Data save: < 100ms

## File Structure Reference

Important files for local testing:

```
/Users/pep/Documents/avaluatron/
├── server.js                      ← Run with "node server.js"
├── index.html                     ← Main app entry
├── app.js                         ← App initialization
├── styles.css                     ← Main styles
├── styles-institutional.css       ← Institutional layer styles
├── js/
│   ├── data.js                   ← Data validation & management
│   ├── views.js                  ← UI rendering
│   ├── state.js                  ← State management
│   ├── institutional.js          ← Institutional manager
│   ├── institutional-ui.js       ← Institutional UI components
│   └── ... (other modules)
├── INSTITUTIONAL_LAYER.md        ← Architecture documentation
└── supabase/
    └── institutional-schema.sql  ← Database schema (for cloud)
```

## Resources

- **Avaluatró Repository**: https://github.com/josep-genis/avaluatron
- **Supabase Docs**: https://supabase.com/docs
- **MDN LocalStorage**: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
- **Browser DevTools**: https://developer.chrome.com/docs/devtools/

## Support

For issues or questions:
1. Check console for error messages
2. Review this guide's "Common Issues" section
3. Check session checkpoint files for prior solutions
4. Run test suite: `npm test` (if available)

---

**Last Updated**: 2024
**Local Testing Setup**: Complete ✅
