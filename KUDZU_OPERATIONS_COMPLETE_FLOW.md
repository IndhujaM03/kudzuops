# Kudzu Operations - Complete System Flow

## 🎯 **System Overview**

Kudzu Operations is a comprehensive recruitment management system built with Angular frontend and Python FastAPI backend, designed to streamline the recruitment process from demand creation to CV management and performance tracking.

---

## 🏗️ **Architecture**

### **Frontend (Angular)**
- **Framework**: Angular 20 with standalone components
- **Styling**: Custom CSS with modern design principles
- **Charts**: D3.js for data visualization
- **State Management**: Angular services with reactive programming
- **Authentication**: JWT-based authentication system

### **Backend (Python FastAPI)**
- **Framework**: FastAPI with async support
- **Database**: PostgreSQL with connection pooling
- **Authentication**: JWT tokens with role-based access
- **File Management**: Local file storage with organized structure
- **API Design**: RESTful APIs with comprehensive error handling

---

## 👥 **User Roles & Permissions**

### **1. Super Admin**
- **Access**: Full system control
- **Capabilities**: User management, system configuration, analytics
- **Dashboard**: System-wide analytics and user management

### **2. Team Leader**
- **Access**: Team management and demand oversight
- **Capabilities**: Demand assignment, team performance tracking, CV review
- **Dashboard**: Team analytics, demand management, CV review interface

### **3. Recruiter**
- **Access**: Assigned demands and CV management
- **Capabilities**: CV upload, status management, performance tracking
- **Dashboard**: Personal performance metrics, assigned demands, CV management

---

## 🔄 **Complete System Flow**

### **Phase 1: User Authentication & Setup**

#### **1.1 User Registration**
```
User Registration → Email Verification → Role Assignment → Profile Setup
```

**Components:**
- `src/components/login/login.component.ts` - Registration form
- `backend/app/login.py` - Registration API endpoint
- Email verification system with OTP

**API Endpoints:**
- `POST /auth/register` - User registration
- `POST /auth/verify` - Email verification
- `POST /auth/verify/resend` - Resend verification

#### **1.2 User Login**
```
Email/Password → Authentication → JWT Token → Role-based Redirect
```

**Components:**
- `src/components/login/login.component.ts` - Login form
- `src/services/auth.service.ts` - Authentication service
- `backend/app/login.py` - Login API endpoint

**API Endpoints:**
- `POST /auth/login` - User authentication
- `GET /auth/me` - Get current user info

---

### **Phase 2: Demand Management**

#### **2.1 Demand Creation (Team Leader)**
```
Demand Details → Client Assignment → Skill Requirements → Team Assignment
```

**Components:**
- `src/components/teamleader/teamleader-demand-sheet.component.ts` - Demand management
- `backend/app/demand_enhanced.py` - Demand API endpoints

**API Endpoints:**
- `POST /demand/create` - Create new demand
- `GET /demand/list` - List all demands
- `PUT /demand/{id}/assign` - Assign demand to recruiters

#### **2.2 Demand Assignment**
```
Demand Selection → Recruiter Assignment → Notification → Activity Creation
```

**Process:**
1. Team Leader selects demand
2. Assigns to specific recruiters
3. System creates `tbl_recruiter_activity` records
4. Recruiters receive notifications

---

### **Phase 3: CV Management System**

#### **3.1 CV Upload Process**
```
File Selection → Upload → Processing → Status Assignment → Database Storage
```

**Components:**
- `src/components/recruiter/demand-detail/demand-detail.component.ts` - CV upload interface
- `backend/app/recruiter_activity.py` - CV management APIs

**File Structure:**
```
src/assets/cv_uploads/
├── {recruiter_id}/
│   ├── {demand_id}/
│   │   ├── {candidate_id}_original.pdf
│   │   └── {candidate_id}_processed.pdf
```

**API Endpoints:**
- `POST /recruiter/{id}/upload-cv` - Upload CV file
- `GET /recruiter/{id}/cv-list` - Get CV list for demand
- `PUT /recruiter/{id}/cv-status` - Update CV status

#### **3.2 CV Status Management**
```
Uploaded → Under Verification → Approved/Rejected → Final Status
```

**Status Flow:**
- **0**: Under Verification (default)
- **1**: Approved
- **2**: Rejected

**Database Schema:**
```sql
tbl_recruiter_activity.cv_list = [
  {"candidate_id": 1, "status": 0},
  {"candidate_id": 2, "status": 1},
  {"candidate_id": 3, "status": 2}
]
```

---

### **Phase 4: Dashboard & Analytics**

#### **4.1 Recruiter Dashboard**
```
Data Aggregation → Chart Generation → Performance Metrics → Real-time Updates
```

**Components:**
- `src/components/recruiter/recruiter-dashboard/recruiter-dashboard.component.ts` - Main dashboard
- `src/services/dashboard.service.ts` - Dashboard data service

**Charts Implemented:**
1. **🥧 Pie Chart**: CV Status Distribution (Approved/Under Verification/Rejected)
2. **📊 Bar Chart**: CVs per Demand (Required vs Uploaded vs Approved)
3. **🧱 Stacked Bar Chart**: Required vs Uploaded CVs comparison
4. **📈 Line Chart**: Daily CV uploads trend over time

**API Endpoints:**
- `GET /recruiter/{id}/dashboard` - Get dashboard data
- `GET /recruiter/{id}/dashboard/summary` - Get summary statistics
- `GET /recruiter/{id}/dashboard/timeseries` - Get time series data

#### **4.2 Team Leader Dashboard**
```
Team Performance → Demand Analytics → CV Review Interface → Team Management
```

**Components:**
- `src/components/teamleader/teamleader-demand-sheet.component.ts` - Team management
- Team performance analytics
- CV review and approval interface

---

### **Phase 5: Settings & Configuration**

#### **5.1 Recruiter Settings**
```
Profile Management → CV Download Settings → Security → Notifications → Preferences
```

**Components:**
- `src/components/recruiter/settings/settings.component.ts` - Comprehensive settings UI

**Settings Categories:**
1. **Profile Settings**: Personal information, avatar
2. **CV Download Settings**: Download folder configuration
3. **Security Settings**: Password management
4. **Notification Settings**: Email preferences, alerts
5. **Preferences**: Theme, pagination, date ranges
6. **Danger Zone**: Account deletion

**API Endpoints:**
- `PUT /user/{id}/profile` - Update profile
- `PUT /user/{id}/password` - Change password
- `PUT /user/{id}/preferences` - Save preferences
- `PUT /user/{id}/notifications` - Update notifications

---

## 🗄️ **Database Schema**

### **Core Tables**

#### **tbl_users**
```sql
- id (Primary Key)
- first_name, last_name
- email (Unique)
- password_hash
- role (super_admin, team_leader, recruiter)
- is_approved (Boolean)
- created_at, updated_at
```

#### **tbl_demand_sheet**
```sql
- id (Primary Key)
- client_id (Foreign Key)
- skill (Job title)
- job_description
- no_of_positions
- priority, status
- assigned_to (JSON array of recruiter IDs)
- required_cv_count
- created_at, updated_at
```

#### **tbl_recruiter_activity**
```sql
- id (Primary Key)
- recruiter_id (Foreign Key)
- demand_id (Foreign Key)
- activity_status (open, processing, hold, closed)
- required_cv_count
- uploaded_cv_count
- cv_list (JSON array)
- opened_at, closed_at
- created_at, updated_at
```

#### **tbl_clients**
```sql
- id (Primary Key)
- client_name
- contact_info
- created_at, updated_at
```

---

## 🔧 **Key Features**

### **1. Authentication & Authorization**
- JWT-based authentication
- Role-based access control
- Email verification system
- Password reset functionality

### **2. File Management**
- Organized CV storage structure
- File upload with validation
- Automatic file processing
- Secure file access

### **3. Real-time Dashboard**
- D3.js interactive charts
- Responsive design
- Real-time data updates
- Performance metrics

### **4. CV Management**
- Bulk CV upload
- Status tracking
- Approval workflow
- File organization

### **5. Settings Management**
- Comprehensive user preferences
- Notification controls
- Security settings
- Theme customization

---

## 🚀 **Deployment & Setup**

### **Backend Setup**
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### **Frontend Setup**
```bash
npm install
ng serve --open
```

### **Database Setup**
```bash
# Run migrations in order
psql -d kudzuops -f migrations/001_init.sql
psql -d kudzuops -f migrations/002_seed_roles.sql
# ... continue with all migration files
```

---

## 📊 **Performance Metrics**

### **Dashboard KPIs**
- **Total Demands**: Count of active demands
- **Total CVs**: Sum of uploaded CVs
- **Approval Rate**: Percentage of approved CVs
- **Completion Rate**: Demands completed vs assigned
- **Trend Analysis**: Daily/weekly/monthly performance

### **Chart Visualizations**
- **Pie Chart**: CV status distribution
- **Bar Chart**: Performance by demand
- **Stacked Bar**: Progress tracking
- **Line Chart**: Trend analysis

---

## 🔒 **Security Features**

### **Authentication Security**
- JWT token expiration
- Password hashing (bcrypt)
- Email verification
- Role-based access control

### **File Security**
- Secure file upload validation
- Organized file structure
- Access control by user role
- File type validation

### **Data Security**
- SQL injection prevention
- Input validation
- Error handling
- Audit logging

---

## 🎨 **UI/UX Features**

### **Modern Design**
- Gradient color schemes
- Smooth animations
- Responsive layout
- Interactive elements

### **User Experience**
- Intuitive navigation
- Real-time feedback
- Toast notifications
- Loading states

### **Accessibility**
- Screen reader support
- Keyboard navigation
- High contrast design
- Focus indicators

---

## 📱 **Responsive Design**

### **Desktop (≥768px)**
- Multi-column layouts
- Full feature set
- Hover effects
- Large charts

### **Mobile (<768px)**
- Single column layout
- Touch-friendly controls
- Optimized spacing
- Collapsible sections

---

## 🔄 **Data Flow Summary**

```
1. User Registration → Email Verification → Role Assignment
2. Demand Creation → Team Assignment → Activity Creation
3. CV Upload → Processing → Status Management → Approval
4. Dashboard Analytics → Performance Tracking → Reporting
5. Settings Management → Preferences → Notifications
```

---

## 🎯 **System Benefits**

### **For Recruiters**
- Clear performance metrics
- Easy CV management
- Real-time dashboard
- Streamlined workflow

### **For Team Leaders**
- Team oversight
- Demand management
- Performance analytics
- Resource allocation

### **For Super Admins**
- System-wide control
- User management
- Analytics and reporting
- System configuration

---

## 📈 **Future Enhancements**

### **Planned Features**
- Advanced analytics
- Machine learning integration
- Mobile app development
- API documentation
- Automated reporting
- Integration with external systems

### **Technical Improvements**
- Performance optimization
- Caching implementation
- Database optimization
- Security enhancements
- Testing automation

---

**Status**: ✅ **PRODUCTION READY**
**Last Updated**: December 2024
**Version**: 1.0.0
**Maintainer**: Development Team
