# Task Management System - Quick Reference Card

## 🚀 Quick Start (30 seconds)

```
1. Admin Dashboard → Task Management
2. Click "Import CSV"
3. Enter source name (optional)
4. Create/select project
5. Upload CSV file
6. Done! ✅
```

---

## 📥 CSV Format Support

### Your Enterprise Format ✅
```csv
Priority,Category,Item,Status,Description,Effort,Dependencies
P0-Critical,Security,Fix CORS,Not Started,Details here,2 hours,None
```

### Simple Format ✅
```csv
Title,Description,Status,Priority,Due Date
Task 1,Description,to_do,high,2025-02-01
```

### Any Custom Format ✅
All columns are preserved - just map what you can!

---

## 🔍 Filters & Search

| Filter | What It Does |
|--------|--------------|
| **Search Bar** | Searches title, description, category, effort, dependencies |
| **Project** | Filter by project |
| **Category** | Filter by task category |
| **Status** | To Do / In Progress / Completed |
| **Priority** | Low / Medium / High / Urgent |
| **Source** | Filter by CSV source/platform |

**Pro Tip:** Combine multiple filters for powerful queries!

---

## ⌨️ Quick Actions

| Action | How To |
|--------|--------|
| **Import CSV** | Import CSV button → Upload file |
| **Export CSV** | Export CSV button (respects filters) |
| **Search** | Type in search bar at top |
| **Quick Edit Status** | Click status dropdown in table |
| **Quick Edit Priority** | Click priority dropdown in table |
| **Quick Edit Due Date** | Click date field in table |
| **Full Edit** | Click edit (pencil) icon |
| **Delete Task** | Click trash icon |
| **Clear Filters** | Click "Clear Filters" button |
| **New Task** | Click "New Task" button |

---

## 🎯 Common Workflows

### Import Multiple Platform CSVs
```
1. Import platform-a.csv → Source: "Platform A"
2. Import platform-b.csv → Source: "Platform B"
3. Import platform-c.csv → Source: "Platform C"
4. Use Source filter to view each separately
```

### Find Critical Tasks
```
1. Priority filter: "Urgent"
2. Status filter: "To Do"
3. Category filter: Choose category
```

### Weekly Report
```
1. Set filters for tasks you want
2. Click "Export CSV"
3. Open in Excel/Sheets
4. Create report
```

### Review by Category
```
1. Category filter: Select category
2. Review tasks
3. Update statuses
4. Move to next category
```

---

## 📊 Field Mapping Reference

| Your CSV | System Field | Auto-Mapped |
|----------|--------------|-------------|
| Priority / priority | priority | ✅ Yes |
| Category / category | category | ✅ Yes |
| Item / Title / title | title | ✅ Yes |
| Status / status | status | ✅ Yes |
| Description | description | ✅ Yes |
| Effort | effort | ✅ Yes |
| Dependencies | dependencies | ✅ Yes |
| Due Date | due_date | ✅ Yes |
| *Any other column* | metadata | ✅ Preserved |

---

## 🎨 Priority Mapping

| Your CSV | Maps To |
|----------|---------|
| P0-Critical, P0, Critical, Urgent | **Urgent** 🔴 |
| P1-High, P1, High | **High** 🟠 |
| P2-Medium, P2, Medium | **Medium** 🟡 |
| P3-Low, P3, Low | **Low** 🟢 |

---

## 📝 Status Mapping

| Your CSV | Maps To |
|----------|---------|
| Not Started, Todo, Pending | **To Do** |
| In Progress, Partial, Working | **In Progress** |
| Complete, Done, Finished | **Completed** |

---

## 💡 Pro Tips

### Best Practices
- ✅ Always name your source/platform
- ✅ Use consistent category names
- ✅ Create separate projects for major initiatives
- ✅ Set due dates for time-sensitive tasks
- ✅ Export regularly for backups

### Search Tips
- Search is case-insensitive
- Partial matches work ("auth" finds "authentication")
- Search across multiple fields at once
- Combine search with filters for precision

### Organization Tips
- **By Platform:** Use Source filter to separate
- **By Priority:** Start with Urgent, work down
- **By Category:** Group related tasks
- **By Project:** Organize by major initiatives

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| CSV won't import | Check format, ensure .csv extension, try sample CSV |
| No tasks showing | Click "Clear Filters" button |
| Wrong priority | System auto-maps, you can edit after import |
| Missing columns | All data preserved in metadata, check export |
| Import error | Check browser console (F12) for details |

---

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| **TASK_MANAGEMENT_USER_GUIDE.md** | Complete user guide with examples |
| **TASK_MANAGEMENT_TECHNICAL_SUMMARY.md** | Technical implementation details |
| **TASK_MANAGEMENT_DEPLOYMENT.md** | Database deployment steps |
| **TASK_MANAGEMENT_QUICK_REFERENCE.md** | This quick reference |

---

## 🆘 Need Help?

1. **Check sample CSV:** Download from Import dialog
2. **Test with small file:** Try 5-10 tasks first
3. **Clear filters:** Often solves "missing" tasks
4. **Check browser console:** Press F12, look for errors
5. **Review user guide:** Detailed help in USER_GUIDE.md

---

## ⭐ Key Features

✅ Import CSVs from any platform
✅ Automatic field mapping
✅ 6 filter types + search
✅ Quick inline editing
✅ Export filtered results
✅ Source tracking
✅ Category organization
✅ Effort tracking
✅ Dependencies tracking

---

## 🎯 Quick Examples

### Example 1: Import Your Enterprise Readiness Checklist
```
Source: "Enterprise Readiness"
Project: Create new "Enterprise Readiness 2025"
File: ENTERPRISE_READINESS_CHECKLIST.csv
Result: 181 tasks organized by category
```

### Example 2: Find All Security Tasks Due This Month
```
Category: Security
Status: To Do + In Progress
Due Date: (manually filter in table view)
Action: Export CSV for report
```

### Example 3: Review P0 Critical Items
```
Search: "P0" or "Critical"
Status: To Do
Result: All critical items needing attention
```

---

## 📞 Quick Support

- **Deployment issues:** See DEPLOYMENT.md
- **Usage questions:** See USER_GUIDE.md
- **Technical details:** See TECHNICAL_SUMMARY.md
- **This reference:** Bookmark this page!

---

**Version:** 2.0
**Last Updated:** December 2, 2025
**Status:** ✅ Production Ready

---

## 🎓 5-Minute Tutorial

**Minute 1:** Navigate to Task Management
**Minute 2:** Click Import CSV, upload your file
**Minute 3:** Explore filters and search
**Minute 4:** Try editing a task inline
**Minute 5:** Export filtered results

**You're now a Task Management pro!** 🎉

