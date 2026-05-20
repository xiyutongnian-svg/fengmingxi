const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'leave-management-secret-2024';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dataDir = path.join(__dirname, '.data');
const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const dbPath = path.join(dataDir, 'database.json');

function loadDB() {
    if (!fs.existsSync(dbPath)) {
        const initialData = {
            students: [
                { id: 1, username: 'student1', password: bcrypt.hashSync('123456', 10), name: '张三', student_no: '2024001', class_name: '计算机2401班' },
                { id: 2, username: 'student2', password: bcrypt.hashSync('123456', 10), name: '李四', student_no: '2024002', class_name: '计算机2401班' },
                { id: 3, username: 'student3', password: bcrypt.hashSync('123456', 10), name: '王五', student_no: '2024003', class_name: '计算机2402班' }
            ],
            teachers: [
                { id: 1, username: 'teacher1', password: bcrypt.hashSync('123456', 10), name: '李老师' },
                { id: 2, username: 'teacher2', password: bcrypt.hashSync('123456', 10), name: '王老师' }
            ],
            teacher_classes: [
                { id: 1, teacher_id: 1, class_name: '计算机2401班' },
                { id: 2, teacher_id: 1, class_name: '计算机2402班' },
                { id: 3, teacher_id: 2, class_name: '计算机2402班' }
            ],
            leaves: []
        };
        fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
        console.log('数据库初始化完成');
    }
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

loadDB();

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ success: false, message: '未登录' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'token无效' });
        req.user = user;
        next();
    });
};

app.post('/api/auth/login', (req, res) => {
    const { username, password, role } = req.body;
    const db = loadDB();
    
    const table = role === 'student' ? 'students' : 'teachers';
    const user = db[table].find(u => u.username === username);
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
    
    user.role = role;
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
    
    const userData = { id: user.id, username: user.username, name: user.name, role: user.role };
    if (role === 'student') {
        userData.student_no = user.student_no;
        userData.class_name = user.class_name;
    }
    
    res.json({ success: true, message: '登录成功', token, user: userData });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
    const db = loadDB();
    const table = req.user.role === 'student' ? 'students' : 'teachers';
    let user = db[table].find(u => u.id === req.user.id);
    
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
    
    user.role = req.user.role;
    if (req.user.role === 'teacher') {
        user.classes = db.teacher_classes.filter(tc => tc.teacher_id === req.user.id).map(tc => tc.class_name);
    }
    
    res.json({ success: true, user });
});

app.post('/api/leave/submit', authMiddleware, (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ success: false, message: '权限不足' });
    }
    
    const { leaveType, startTime, endTime, reason, attachmentPath } = req.body;
    
    if (!leaveType || !startTime || !endTime || !reason) {
        return res.status(400).json({ success: false, message: '请填写完整信息' });
    }
    
    if (leaveType === '病假' && !attachmentPath) {
        return res.status(400).json({ success: false, message: '病假需要上传证明' });
    }
    
    const db = loadDB();
    const newLeave = {
        id: db.leaves.length > 0 ? Math.max(...db.leaves.map(l => l.id)) + 1 : 1,
        student_id: req.user.id,
        leave_type: leaveType,
        start_time: startTime,
        end_time: endTime,
        reason: reason,
        attachment_path: attachmentPath || null,
        status: '待审批',
        teacher_comment: null,
        submitted_at: new Date().toISOString(),
        approved_at: null,
        approver_id: null
    };
    
    db.leaves.push(newLeave);
    saveDB(db);
    
    res.json({ success: true, message: '提交成功', leaveId: newLeave.id });
});

app.get('/api/leave/my-leaves', authMiddleware, (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ success: false, message: '权限不足' });
    }
    
    const db = loadDB();
    const leaves = db.leaves.filter(l => l.student_id === req.user.id).map(leave => {
        const student = db.students.find(s => s.id === leave.student_id);
        const approver = leave.approver_id ? db.teachers.find(t => t.id === leave.approver_id) : null;
        return {
            ...leave,
            student_name: student?.name,
            student_no: student?.student_no,
            class_name: student?.class_name,
            approver_name: approver?.name
        };
    }).sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
    
    res.json({ success: true, leaves });
});

app.get('/api/leave/pending', authMiddleware, (req, res) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ success: false, message: '权限不足' });
    }
    
    const db = loadDB();
    const teacherClasses = db.teacher_classes.filter(tc => tc.teacher_id === req.user.id).map(tc => tc.class_name);
    
    const leaves = db.leaves.filter(l => l.status === '待审批').map(leave => {
        const student = db.students.find(s => s.id === leave.student_id);
        if (!student || !teacherClasses.includes(student.class_name)) return null;
        return {
            ...leave,
            student_name: student.name,
            student_no: student.student_no,
            class_name: student.class_name
        };
    }).filter(l => l !== null).sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
    
    res.json({ success: true, leaves });
});

app.get('/api/leave/approved', authMiddleware, (req, res) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ success: false, message: '权限不足' });
    }
    
    const db = loadDB();
    const teacherClasses = db.teacher_classes.filter(tc => tc.teacher_id === req.user.id).map(tc => tc.class_name);
    
    const leaves = db.leaves.filter(l => l.status !== '待审批').map(leave => {
        const student = db.students.find(s => s.id === leave.student_id);
        const approver = leave.approver_id ? db.teachers.find(t => t.id === leave.approver_id) : null;
        if (!student || !teacherClasses.includes(student.class_name)) return null;
        return {
            ...leave,
            student_name: student.name,
            student_no: student.student_no,
            class_name: student.class_name,
            approver_name: approver?.name
        };
    }).filter(l => l !== null).sort((a, b) => new Date(b.approved_at) - new Date(a.approved_at));
    
    res.json({ success: true, leaves });
});

app.get('/api/leave/:id', authMiddleware, (req, res) => {
    const db = loadDB();
    const leave = db.leaves.find(l => l.id === parseInt(req.params.id));
    
    if (!leave) return res.status(404).json({ success: false, message: '记录不存在' });
    
    const student = db.students.find(s => s.id === leave.student_id);
    const approver = leave.approver_id ? db.teachers.find(t => t.id === leave.approver_id) : null;
    
    res.json({
        success: true,
        leave: {
            ...leave,
            student_name: student?.name,
            student_no: student?.student_no,
            class_name: student?.class_name,
            approver_name: approver?.name
        }
    });
});

app.post('/api/leave/:id/approve', authMiddleware, (req, res) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ success: false, message: '权限不足' });
    }
    
    const db = loadDB();
    const leave = db.leaves.find(l => l.id === parseInt(req.params.id));
    
    if (!leave) return res.status(404).json({ success: false, message: '记录不存在' });
    if (leave.status !== '待审批') return res.status(400).json({ success: false, message: '已审批过' });
    
    leave.status = '已批准';
    leave.approver_id = req.user.id;
    leave.approved_at = new Date().toISOString();
    
    saveDB(db);
    res.json({ success: true, message: '批准成功' });
});

app.post('/api/leave/:id/reject', authMiddleware, (req, res) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ success: false, message: '权限不足' });
    }
    
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: '拒绝理由不能为空' });
    
    const db = loadDB();
    const leave = db.leaves.find(l => l.id === parseInt(req.params.id));
    
    if (!leave) return res.status(404).json({ success: false, message: '记录不存在' });
    if (leave.status !== '待审批') return res.status(400).json({ success: false, message: '已审批过' });
    
    leave.status = '已拒绝';
    leave.approver_id = req.user.id;
    leave.approved_at = new Date().toISOString();
    leave.teacher_comment = reason;
    
    saveDB(db);
    res.json({ success: true, message: '已拒绝' });
});

app.get('/api/leave/stats/teacher', authMiddleware, (req, res) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ success: false, message: '权限不足' });
    }
    
    const db = loadDB();
    const teacherClasses = db.teacher_classes.filter(tc => tc.teacher_id === req.user.id).map(tc => tc.class_name);
    
    const stats = { pending: 0, approved: 0, rejected: 0 };
    
    db.leaves.forEach(leave => {
        const student = db.students.find(s => s.id === leave.student_id);
        if (student && teacherClasses.includes(student.class_name)) {
            if (leave.status === '待审批') stats.pending++;
            else if (leave.status === '已批准') stats.approved++;
            else if (leave.status === '已拒绝') stats.rejected++;
        }
    });
    
    res.json({ success: true, stats });
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'leave-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.pdf'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('只支持 jpg、png、pdf 格式'), false);
        }
    }
});

app.post('/api/upload/attachment', authMiddleware, (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        if (!req.file) return res.status(400).json({ success: false, message: '请选择文件' });
        
        res.json({
            success: true,
            message: '上传成功',
            path: `/uploads/${req.file.filename}`,
            filename: req.file.originalname
        });
    });
});

app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: '服务运行正常' });
});

app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});
