

# 📅 TU Room Booking System

โปรเจกต์นี้เป็น **ระบบจองห้องประชุมและห้องเรียน (Room Booking System)** พัฒนาด้วยสถาปัตยกรรม Django REST Framework (DRF)

> 💡 **สถานะปัจจุบัน (Project Setup):**
>
>   * โครงสร้างโฟลเดอร์และแอปพลิเคชันพื้นฐานถูกสร้างไว้เรียบร้อยแล้ว
>   * Models และ Views ตอนนี้ยังเป็น **Skeleton / Mock** เพื่อรอการเชื่อมต่อ
>   * **Role 3 (Database):** สามารถเข้ามาอัปเดตไฟล์ `models.py` ของทั้ง `rooms` และ `bookings` ตาม ER Diagram ที่ออกแบบไว้ได้เลย

-----

## 📑 สารบัญ

  * [โครงสร้างโปรเจกต์](#โครงสร้างของโปรเจกต์)
  * [กฎการทำงานร่วมกัน (สำคัญมาก)](#กฎการทำงานร่วมกัน-สำคัญมาก)
  * [สิ่งที่ทำไปแล้ว](#สิ่งที่ทำไปแล้ว)
  * [วิธีเริ่มใช้งาน](#วิธีเริ่มใช้งาน)

-----

## 🏗️ โครงสร้างโปรเจกต์ (Project Structure)

โปรเจกต์นี้ใช้สถาปัตยกรรมแบบ Service Layer และแบ่งแอปแยกตามหน้าที่ชัดเจน (Separation of Concerns):

  * **`config/`**
    โฟลเดอร์หลักสำหรับตั้งค่าโปรเจกต์ (Settings, Main URLs) ไม่ใช่ชื่อเดียวกับโปรเจกต์เพื่อให้แยกส่วน Config ออกจาก Logic ชัดเจน

  * **`rooms/`**
    แอปสำหรับเก็บข้อมูลห้องพัก (Room Model) เช่น ชื่อห้อง, ความจุ, อุปกรณ์
    
    ⚠️ *ไม่มี Logic การจองที่นี่ เพื่อไม่ให้ระบบผูกติดกันเกินไป*

  * **`bookings/`** แอปหลักสำหรับจัดการการจองห้อง แบ่งโครงสร้างภายในดังนี้:

      * `models.py` / `serializers.py`: จัดการ Database และการแปลงข้อมูล
      * `views/`: **(แยกเป็นโฟลเดอร์)** เพื่อให้ Backend 2 คนทำงานขนานกันได้โดย Git ไม่ชนกัน
      * `services/`: โฟลเดอร์สำหรับเก็บ Business Logic ยากๆ เช่น เช็กเวลาทับซ้อน (Conflict Detection) จะเขียนที่นี่ ไม่เขียนปนใน Views

-----

## 🛑 กฎการทำงานร่วมกัน (สำคัญมาก)

เพื่อป้องกันปัญหา Git Merge Conflict (โค้ดชนกัน) ขอให้ทุกคนปฏิบัติตามนี้:

1.  **สำหรับ Backend (Role 1 และ Role 2):**
      * **Role 1 (มีน):** จะรับผิดชอบไฟล์ `bookings/views/booking_views.py` เท่านั้น
      * **Role 2 (ระบบอนุมัติ):** ให้สร้างไฟล์ใหม่ชื่อ `bookings/views/approval_views.py` หรือ `admin_views.py` เพื่อทำงานของตัวเอง
2.  **สำหรับทุกคน:**
      * แตก Branch ใหม่ทุกครั้งที่ทำงาน (เช่น `feature/room-models`) 

-----

## ✅ สิ่งที่ทำไปแล้ว 

  * [x] Initialize Django Project & Virtual Environment
  * [x] ตั้งค่า `config/settings.py` เบื้องต้น (เชื่อม SQLite สำหรับ Dev **โดยต้องเปลี่ยนไปเชื่อม PostgreSQL ในภายหลัง**)
  * [x] สร้าง App `rooms` และ `bookings`
  * [x] วางโครงสร้างไฟล์แบบ Service Layer (`views/`, `services/`)
  * [x] สร้างไฟล์ `bookings/views/booking_views.py` เตรียมไว้สำหรับ Logic การจอง
  * [x] ร่างโครงสร้าง models.py สำหรับแอป bookings และ rooms (ตั้งเป็น Skeleton ไว้ให้ Role 3 มาสานต่อ)
  * [x] รันคำสั่ง makemigrations และ migrate สร้างตารางลง Database เบื้องต้น
  * [x] สร้าง bookings/serializers.py สำหรับตรวจสอบและแปลงข้อมูล JSON (Request/Response) ตาม API Contract

-----

### 📌 Note เพิ่มเติมสำหรับเพื่อนในทีม (รายบุคคล)

#### **🗄️ สำหรับ Role 3 (Database & Report):**
* **การเชื่อมต่อ PostgreSQL:** เมื่อออกแบบ ER Diagram เสร็จและพร้อมจะเปลี่ยนจาก SQLite เป็น PostgreSQL ให้เข้าไปแก้ไขที่ไฟล์ `config/settings.py` ในส่วนของ `DATABASES`
* **Environment Variables:** รบกวนใช้ค่าการเชื่อมต่อ (DB_NAME, DB_USER, DB_PASSWORD) ผ่านไฟล์ `.env` โดยใช้ฟังก์ชัน `config` จาก `python-decouple` ที่ติดตั้งไว้ให้แล้ว เพื่อความปลอดภัยและให้ Role 4 นำไปเซ็ตอัปใน Docker ได้ง่ายค่ะ

#### **🔐 สำหรับ Role 2 (Workflow & Admin):**
* **Admin Views:** ให้สร้างไฟล์ `bookings/views/approval_views.py` แยกออกมาได้เลย และถ้าต้องการเรียกใช้ Logic การเช็กเวลาทับซ้อน สามารถ Import ฟังก์ชันจาก `bookings/services/conflict.py` ไปใช้ได้ทันทีค่ะ

#### **⚙️ สำหรับ Role 4 (Auth & DevOps):**
* **API Key:** ดำเนินการขอ Application-Key จาก [TU REST API](https://restapi.tu.ac.th) ตั้งแต่เนิ่น ๆ เนื่องจากอาจต้องใช้เวลาในการอนุมัติ
* **Docker Config:** สร้างไฟล์ Dockerfile และ docker-compose.yml ไว้ที่ Root ของโปรเจกต์ด้วยนะคะ และตอนเซ็ตคำสั่งรัน Server (เช่น Gunicorn) อย่าลืมชี้ path มาที่โฟลเดอร์ config/ (ไม่ใช่ชื่อโปรเจกต์เดิม) ด้วยนะคะ

#### **🎨 สำหรับ Role 5 (Frontend):**
* **API Integration:** ให้ดูโครงสร้าง JSON Request และ Response จากไฟล์ API Contract ที่สรุปไว้ให้ และใช้วิธี "Mock Data" (สร้างตัวแปรจำลองข้อมูล) ฝังไว้ในโค้ดหน้าเว็บไปก่อนนะคะ จะได้เขียน UI ต่อได้เลยโดยไม่ต้องรอหลังบ้านเสร็จ

---

## 🚀 วิธีเริ่มใช้งาน (Getting Started)

1.  **Clone repository**

<!-- end list -->

```bash
git clone <repository_url>
cd room_booking_system
```

2.  **สร้าง Virtual Environment และติดตั้ง dependencies**

<!-- end list -->

```bash
python -m venv venv
source venv/bin/activate  # สำหรับ Mac/Linux
# สำหรับ Windows ใช้: venv\Scripts\activate

pip install -r requirements.txt
```

3.  **ตั้งค่า Environment Variables**
    คัดลอกไฟล์ตัวอย่างและแก้ไขค่าข้างใน (เช่น SECRET\_KEY, DEBUG)

<!-- end list -->

```bash
cp .env.example .env
```

4.  **รัน Migrations เพื่อสร้างตารางฐานข้อมูล**

<!-- end list -->

```bash
python manage.py migrate
```

5.  **Start Server**

<!-- end list -->

```bash
python manage.py runserver
```

-----