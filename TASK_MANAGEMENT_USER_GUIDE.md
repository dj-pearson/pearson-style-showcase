# Task Management System - User Guide

## Overview

Your enhanced Task Management system now supports importing CSV files from multiple platforms, powerful filtering, search capabilities, and export functionality. This guide will help you manage tasks from all your platforms in one centralized location.

---

## 🚀 Quick Start

### Access the Task Management Dashboard

1. Log in to your admin dashboard
2. Navigate to **Task Management** from the sidebar
3. You'll see two tabs:
   - **Tasks**: View and manage all tasks
   - **Projects**: Organize tasks into projects

---

## 📥 Importing Tasks from CSV

### Step 1: Prepare Your CSV

Your CSV can have any of these formats:

#### Enterprise Format (like your ENTERPRISE_READINESS_CHECKLIST.csv)
```csv
Priority,Category,Item,Status,Description,Effort,Dependencies
P0-Critical,Core Auth,Fix CORS policies,Not Started,Restrict Access-Control-Allow-Origin,2 hours,None
P1-High,Security,Add rate limiting,In Progress,Implement rate limiting on endpoints,8 hours,None
```

#### Simple Format
```csv
Title,Description,Status,Priority,Due Date
Task 1,Description here,to_do,high,2025-02-01
Task 2,Another task,in_progress,medium,2025-02-15
```

**Supported Columns:**
- `Priority` or `priority` → Maps to: Urgent, High, Medium, Low
- `Category` → Categorizes tasks (e.g., "Core Auth", "Security")
- `Item` or `Title` → Task title
- `Status` → Maps to: To Do, In Progress, Completed
- `Description` → Task description
- `Effort` → Time estimate (e.g., "2 hours", "4 hours")
- `Dependencies` → Related dependencies
- `Due Date` → Target completion date

**Automatic Mapping:**
- `P0-Critical` → Urgent priority
- `P1-High` → High priority
- `P2-Medium` → Medium priority
- `P3-Low` → Low priority
- `Not Started` → To Do status
- `In Progress` → In Progress status
- `Completed/Done` → Completed status

### Step 2: Import Your CSV

1. Click **Import CSV** button
2. **Enter Source/Platform Name** (optional but recommended)
   - Example: "Enterprise Readiness", "Platform A", "Client Project"
   - This helps you track where tasks came from
3. Choose how to organize:
   - **Option A: Create New Project**
     - Check "Create new project for this import"
     - Enter a project name (e.g., "Enterprise Readiness 2025")
   - **Option B: Add to Existing Project**
     - Select an existing project from the dropdown
4. Click **Download Sample CSV** if you need a template
5. Click **Upload CSV** and select your file
6. Tasks will be imported automatically!

**What Happens:**
- All tasks are imported with their original data preserved
- Priority levels are automatically converted
- Status values are standardized
- Additional CSV columns are saved in metadata
- Tasks are tagged for easy searching

---

## 🔍 Finding and Filtering Tasks

### Search Bar
Located at the top of the task list, searches across:
- Task titles
- Descriptions
- Categories
- Effort estimates
- Dependencies
- Original priority values

**Example:** Search for "auth" to find all authentication-related tasks

### Filters

**Project Filter**
- Filter tasks by project
- Shows project color coding

**Category Filter**
- Filter by category (e.g., "Core Auth", "Security", "Billing")
- Automatically populated from your imported tasks

**Status Filter**
- To Do
- In Progress
- Completed

**Priority Filter**
- Low
- Medium
- High
- Urgent

**Source Filter**
- Filter by the platform/CSV source
- Shows which system each task came from

**Active Filters**
- Badge shows how many filters are active
- Click "Clear Filters" to reset all filters

### Task Count
Always visible at the top: "X of Y tasks" showing filtered vs total

---

## 📊 Viewing Tasks

### Task Table Columns

1. **Title** - Task name with source badge
2. **Category** - Categorization with tag icon
3. **Project** - Project name with color indicator
4. **Status** - Editable dropdown (To Do, In Progress, Completed)
5. **Priority** - Editable dropdown (Low, Medium, High, Urgent)
   - Hover to see original priority from CSV
6. **Effort** - Time estimate with clock icon
7. **Due Date** - Editable date picker
8. **Actions** - Edit and Delete buttons

### Subtasks
- Tasks with subtasks show an expand/collapse arrow
- Click to view subtask details inline

---

## ✏️ Editing Tasks

### Quick Edit (In Table)
- **Status**: Click dropdown to change
- **Priority**: Click dropdown to change
- **Due Date**: Click date field to update

### Full Edit (Dialog)
1. Click the **Edit** button (pencil icon)
2. Edit any field:
   - Title
   - Description
   - Category
   - Source/Platform
   - Project
   - Status
   - Priority
   - Original Priority
   - Effort
   - Due Date
   - Start Date
   - Dependencies
   - Links (JSON array)
3. Click **Update** to save

---

## ➕ Creating New Tasks

1. Click **New Task** button
2. Fill in the form:
   - **Required**: Title
   - **Optional**: All other fields
3. Click **Create**

---

## 📤 Exporting Tasks

### Export Filtered Tasks to CSV

1. Apply any filters you want
2. Click **Export CSV** button
3. CSV file downloads with:
   - Title
   - Category
   - Priority (original if available)
   - Status
   - Description
   - Effort
   - Dependencies
   - Source
   - Project
   - Due Date
   - Created Date

**Use Cases:**
- Share tasks with team members
- Create reports for management
- Backup your task data
- Import into other tools

---

## 🏗️ Managing Projects

### View Projects Tab
1. Click **Projects** tab
2. See all your projects organized

### Create New Project
1. Can be done during CSV import OR
2. Create manually in Projects tab

### Project Features
- Color coding for visual organization
- Platform/domain tracking
- Status management
- Description and metadata

---

## 💡 Best Practices

### Organizing Multiple Platforms

**Option 1: One Project Per Platform**
```
✓ Enterprise Readiness (Project)
  - Source: ENTERPRISE_READINESS_CHECKLIST.csv
  - 181 tasks

✓ Platform A (Project)
  - Source: platform-a-tasks.csv
  - 95 tasks
```

**Option 2: One Project with Multiple Sources**
```
✓ All Tasks 2025 (Project)
  - Filter by source to separate platforms
```

### Naming Conventions

**Sources/Platforms:**
- Use consistent, descriptive names
- Example: "Enterprise Readiness", "Client X Project", "Internal Backlog"

**Categories:**
- Keep consistent across imports
- Examples: "Core Auth", "Security", "CRM", "Infrastructure"

### Workflow Tips

1. **Import** → Import your CSV files
2. **Categorize** → Use filters to review by category
3. **Prioritize** → Sort by priority to see critical tasks
4. **Plan** → Set due dates for upcoming tasks
5. **Track** → Update status as you work
6. **Export** → Generate reports as needed

---

## 🔧 Advanced Features

### Search Operators
- Search is case-insensitive
- Partial matches work (search "auth" finds "authentication")
- Searches across multiple fields simultaneously

### Metadata Preservation
- All original CSV columns are preserved
- Even if not displayed, data is saved in metadata field
- Can be exported back out

### Automatic Mapping Functions
The system uses intelligent mapping:
- Priority detection (P0, P1, Critical, High, etc.)
- Status normalization
- Field aliasing (Item = Title, etc.)

---

## 📋 Example Workflows

### Workflow 1: Import Enterprise Readiness Tasks
```
1. Click "Import CSV"
2. Source Name: "Enterprise Readiness"
3. Check "Create new project"
4. Project Name: "Enterprise Readiness 2025"
5. Upload: ENTERPRISE_READINESS_CHECKLIST.csv
6. Result: 181 tasks imported, organized by category
```

### Workflow 2: Find All Critical Security Tasks
```
1. Category Filter: "Security"
2. Priority Filter: "Urgent"
3. Status Filter: "To Do"
4. Result: See all critical security tasks that need attention
```

### Workflow 3: Export This Week's Tasks
```
1. Status Filter: "To Do" + "In Progress"
2. (Manually review due dates in table)
3. Click "Export CSV"
4. Result: CSV with current week's work
```

### Workflow 4: Track Multiple Client Projects
```
1. Import client-a.csv with Source: "Client A"
2. Import client-b.csv with Source: "Client B"
3. Use Source Filter to switch between clients
4. Use Project Filter for more granular organization
```

---

## 🎯 Field Reference

### CSV Field Mapping

| Your CSV Column | System Field | Notes |
|----------------|--------------|-------|
| Priority / priority | priority + original_priority | Auto-mapped to urgency level |
| Category / category | category | Used for filtering |
| Item / Title / title | title | Task name (required) |
| Status / status | status | Auto-mapped to system status |
| Description / description | description | Full task details |
| Effort / effort | effort | Time estimate display |
| Dependencies / dependencies | dependencies | Related task info |
| Due Date / due_date | due_date | Target completion |
| (Any other column) | metadata | Preserved for export |

### Status Values
- `to_do` - Not yet started
- `in_progress` - Currently working
- `completed` - Finished

### Priority Values
- `low` - Low priority
- `medium` - Medium priority
- `high` - High priority
- `urgent` - Critical/urgent priority

---

## 🗄️ Database Schema

For reference, here are the enhanced fields:

**Tasks Table:**
- `id` - Unique identifier
- `title` - Task name
- `description` - Full description
- `category` - Task category
- `status` - Current status
- `priority` - System priority level
- `original_priority` - Original CSV priority
- `effort` - Time estimate
- `dependencies` - Task dependencies
- `source` - Platform/CSV source name
- `project_id` - Associated project
- `due_date` - Target date
- `start_date` - Start date
- `tags` - Searchable tags array
- `metadata` - Additional CSV fields
- `created_at` - Import timestamp
- `updated_at` - Last modified

---

## 🆘 Troubleshooting

### Import Issues

**CSV Won't Import**
- Check that file is .csv format
- Ensure at least one column has task titles
- Verify no completely empty rows

**Missing Data After Import**
- Check if column names are slightly different
- Data is preserved in metadata even if not displayed
- Export to verify all data was captured

**Wrong Priority/Status**
- System auto-maps common values
- You can edit any task after import
- Use original_priority field to see CSV value

### Performance

**Slow with Many Tasks**
- Use filters to reduce displayed tasks
- Search is optimized for speed
- Consider splitting into multiple projects

**Export Takes Time**
- Large exports (1000+ tasks) may take a moment
- Browser will download automatically when ready

---

## 📞 Support

Need help? Check:
1. This guide for common questions
2. Download sample CSV to see format
3. Test with small CSV first (5-10 tasks)
4. Check browser console for any errors

---

## ✅ Summary

You now have a powerful, flexible task management system that:
- ✅ Imports CSVs from any platform
- ✅ Automatically maps and normalizes data
- ✅ Provides powerful search and filtering
- ✅ Supports inline editing and updates
- ✅ Exports filtered results back to CSV
- ✅ Tracks source/platform for each task
- ✅ Preserves all original data
- ✅ Scales to thousands of tasks

**Next Steps:**
1. Import your first CSV
2. Explore the filtering options
3. Set up projects for organization
4. Start tracking and completing tasks!

---

**System Version:** Enhanced Task Management v2.0
**Last Updated:** December 2, 2025

