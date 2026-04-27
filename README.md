# 📅 TU Room Booking System

โปรเจกต์นี้เป็น **ระบบจองห้องประชุมและห้องเรียน (Room Booking System)** พัฒนาด้วยสถาปัตยกรรม Django REST Framework (DRF)

> 💡 **สถานะปัจจุบัน (Role 1 Completed (ready to integration)):**
>
>   * **Role 1 (Meen):** พัฒนาโมดูลจองห้องและคำนวณ Conflict ตารางชนเสร็จสิ้นสมบูรณ์ 100% (รองรับ Concurrency, Timezone และ N+1 Optimization)
>   * **API Specification:** สามารถเข้าดู Swagger UI ได้แล้วที่ `http://localhost:8000/api/schema/swagger-ui/`
>   * **Database & Docker:** ปัจจุบันระบบรันผ่าน Docker Compose ควบคู่กับฐานข้อมูล PostgreSQL อย่างสมบูรณ์แบบ

-----

## 📑 สารบัญ

  * [โครงสร้างโปรเจกต์](#โครงสร้างโปรเจกต์-project-structure)
  * [กฎการทำงานร่วมกัน (สำคัญมาก)](#กฎการทำงานร่วมกัน-สำคัญมาก)
  * [สิ่งที่ทำไปแล้ว (Changelog)](#สิ่งที่ทำไปแล้ว-changelog)
  * [Note เพิ่มเติมสำหรับเพื่อนในทีม](#note-เพิ่มเติมสำหรับเพื่อนในทีม)
  * [วิธีเริ่มใช้งาน](#วิธีเริ่มใช้งาน-getting-started)

-----

## 🏗️ โครงสร้างโปรเจกต์ (Project Structure)

โปรเจกต์นี้ใช้สถาปัตยกรรมแบบ Service Layer และแบ่งแอปแยกตามหน้าที่ชัดเจน (Separation of Concerns):

  * **`config/`** โฟลเดอร์หลักสำหรับตั้งค่าโปรเจกต์ และ Main URLs
  * **`rooms/`** แอปเก็บข้อมูลห้องพัก (Room Model) และตารางการใช้ห้อง (Schedule / Blackout)
  * **`bookings/`** แอปหลักสำหรับจัดการการจองห้อง แบ่งโครงสร้างภายในดังนี้:
      * `models.py` / `serializers.py`: จัดการ Database และการแปลงข้อมูล API
      * `views/`: โฟลเดอร์เก็บ API endpoints ต่างๆ (`booking_views.py`)
      * `services/`: โฟลเดอร์เก็บ Business Logic ที่ซับซ้อน เช่น `conflict_check_service.py` และ `recurring.py` เพื่อให้ View ไม่รก
      * `permissions.py`: ระบบจำกัดสิทธิ์การเข้าถึงข้อมูล (Custom DRF Permissions)
      * `validators.py`: เช็กเงื่อนไขจองล่วงหน้า 150 วัน หรือห้ามจองข้ามคืน

-----

## 🛑 กฎการทำงานร่วมกัน (สำคัญมาก)

เพื่อป้องกันปัญหา Git Merge Conflict (โค้ดชนกัน) ขอให้ทุกคนปฏิบัติตามนี้:

1.  **สำหรับ Backend (Role 1 และ Role 2):**
      * **Role 1 (มีน):** รับผิดชอบไฟล์ใน `bookings/views/booking_views.py` และ `rooms/views.py`
      * **Role 2 (ระบบอนุมัติ):** ให้สร้างไฟล์ใหม่ชื่อ `bookings/views/approval_views.py` หรือ `admin_views.py` สำหรับเขียนฟีเจอร์ของตัวเอง
2.  **สำหรับทุกคน:**
      * แตก Branch ใหม่ทุกครั้งที่ทำงาน (เช่น `feature/email-notification`) ห้ามผลักโค้ดเข้า Main โดยตรง

-----

## ✅ สิ่งที่ทำไปแล้ว (Changelog)

**Phase 1-4 (Role 1: Meen)**
  * [x] **Room API (`/api/rooms/`)**: ดึงรายการห้อง, ตารางการใช้งาน (Schedule), และช่วงเวลาปิดปรับปรุง (Blackout)
  * [x] **Booking API (`/api/bookings/`)**: สร้างการจอง (แบบเดี่ยวและกลุ่ม), เช็ค Conflict, ยกเลิกการจอง, ดูประวัติการจองของตัวเอง
  * [x] **Business Logic**: ระบบสุ่มหาวันที่ทับซ้อน (Conflict Detection) พร้อมป้องกันปัญหา Database N+1 Queries
  * [x] **Concurrency Safety**: ล็อคตารางการจองพร้อมกันระดับ Database (Row-level lock) ด้วย `select_for_update` ใน Transaction ป้องกันการจองชนกันในเสี้ยววินาที
  * [x] **Security & Authorization**: สร้าง Custom Permissions อนุญาตให้ดู/ยกเลิก ได้เฉพาะเจ้าของ (Owner) หรือ Admin เท่านั้น
  * [x] **API Documentation**: ติดตั้ง `drf-spectacular` สร้างหน้า Swagger UI ไว้อ่าน API Docs ได้อัตโนมัติ
  * [x] **Automated Testing**: เขียน Unit Test ครอบคลุมเคสต่างๆ ทั้งของ Rooms และ Bookings เรียบร้อยแล้ว

-----

## 📌 Note เพิ่มเติมสำหรับเพื่อนในทีม

#### **🔐 สำหรับ Role 2 (System Admin):**
* **Auto-Pending:** ตอนนี้ API ฝั่ง Role 1 จะสร้าง Booking ด้วยสถานะ `Pending` เสมอ รบกวน Role 2 ช่วยเขียน Django Signal หรือ API เพื่อเปลี่ยนเป็น `Approved`/`Rejected` ต่อนะคะ
* **Admin Cancellation API:** ถ้า Admin อยากบังคับยกเลิกการจองของอาจารย์คนอื่น **ต้องเขียน API ยกเลิกเพิ่มเองในฝั่ง Role 2 นะคะ** เพราะ API ฝั่ง Role 1 (SYS-20) ล็อคสิทธิ์ให้เฉพาะอาจารย์ยกเลิกของตัวเองได้เท่านั้นค่ะ

#### **⚙️ สำหรับ Role 4 (Notification / Email):**
* **Signal Trigger พร้อมแล้ว!** เวลา User กดยกเลิกการจองทั้งแบบเดี่ยวและแบบกลุ่ม (Recurring) เราใช้คำสั่ง `bk.save()` ในลูปเสมอ ดังนั้น **Django `post_save` Signal จะยิงไปหา Role 4 แน่นอนค่ะ** ให้คอยดักฟัง `status == "Cancelled"` ไว้ส่งอีเมลได้เลย
* **Docker & OpenAPI:** ตอนนี้ระบบรันผ่าน Docker Compose ได้สมบูรณ์ และมี Swagger UI ติดตั้งไว้ที่ `/api/schema/swagger-ui/` ให้ทุกคนใช้อ่าน API ง่ายๆ ค่ะ

#### **🎨 สำหรับ Role 5 (Frontend):**
* **API พร้อมใช้ 100%!** เลิกใช้ Mock Data ได้เลยค่ะ Backend เปิด Endpoint พร้อมให้ยิง Postman/Axios แล้ว 
* **อ่าน API Specs:** ไม่ต้องเดาโครงสร้าง JSON Request/Response อีกต่อไป เข้าไปดูเอกสาร (Swagger) ที่สร้างให้อัตโนมัติได้ที่ `http://localhost:8000/api/schema/swagger-ui/` ค่ะ 

---

## 🚀 วิธีเริ่มใช้งาน (Getting Started)

1.  **Clone repository**
```bash
git clone <repository_url>
cd room_booking_system
```

2.  **รันระบบด้วย Docker Compose**
โปรเจกต์ถูกเซ็ตอัปให้รันผ่าน Docker เรียบร้อยแล้ว (มี PostgreSQL, pgAdmin และ Django)
```bash
docker compose up -d --build
```

3.  **สร้างฐานข้อมูล (ถ้าเพิ่งรันครั้งแรก)**
```bash
docker compose exec django python manage.py migrate
```

4.  **เข้าใช้งานระบบ**
* **API Documentation (Swagger):** `http://localhost:8000/api/schema/swagger-ui/`
* **Django API (Browsing):** `http://localhost:8000/api/`
* **pgAdmin (Database Manager):** `http://localhost:5050`