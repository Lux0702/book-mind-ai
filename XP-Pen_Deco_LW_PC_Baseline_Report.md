# Báo Cáo Chuẩn Kết Nối XP-Pen Deco LW & Windows Ink (Working PC Baseline)

> **Mục đích**: Đây là toàn bộ thông số kỹ thuật của chiếc **PC đang kết nối và sử dụng bình thường cả phím tắt lẫn bút** của bảng vẽ **XP-Pen Deco LW**. Dùng tài liệu này cho **Antigravity trên Laptop ở nhà** để chạy đối chiếu (diff) và tìm chính xác nguyên nhân xung đột khiến Laptop chỉ chạy được phím tắt còn bút không chạy hoặc mất kết nối sau 1–2 phút.
> - **Ngày xuất**: 21/11/2026 15:43
> - **Thiết bị**: XP-Pen Deco LW (`USB\VID_28BD&PID_0935`)
> - **Phần mềm XP-Pen**: `XPPenTablet` v`4.0.18.260720`

---

## 0. Tóm Tắt Nhanh (Baseline Fingerprint)

| Hạng mục | Giá trị chuẩn trên PC đang chạy tốt |
|---|---|
| **Hệ điều hành** | Microsoft Windows 10 Pro 22H2 (Build `19045.5131`, 64-bit) |
| **Mainboard / USB Controller** | Gigabyte `H610M H V3 DDR4` / Intel USB 3.20 eXtensible Host Controller (`PCI\VEN_8086&DEV_7AE0`) |
| **Core Isolation / HVCI** | **TẮT / Không cấu hình** (`HypervisorEnforcedCodeIntegrity` key không tồn tại) |
| **Phương thức kết nối** | **USB** (`USB\VID_28BD&PID_0935\0000000000`), không dùng Bluetooth |
| **Phần mềm XP-Pen** | `XPPenTablet` phiên bản **`4.0.18.260720`** (`C:\Program Files\XPPen\XPPenTablet.exe`) |
| **Driver nhân & Filter** | `XPPenTablet.sys` (`6.1.7600.16385`, `oem54.inf`) + `hanvonugeemfilter.sys` (`14.27.40.873`, `oem60.inf`) |
| **WinTab32.dll** | Cả `System32` (146,944 B) và `SysWOW64` (126,464 B) đều là bản XPPen **`1.5.2.0`** (2023-09-19) |
| **Windows Ink (trong XPPen)** | **BẬT** (`<TablePC>1</TablePC>` trong profile `<Dec1013>` của `%APPDATA%\XPPen\config.xml`) |
| **Windows Services** | `TabletInputService`: **Running (Automatic)**, `hidserv`: **Running (Manual)**, `bthserv`: **Running (Automatic)** |
| **Driver hãng khác** | **KHÔNG CÓ** (không có Wacom, Huion, Gaomon, Veikk, OpenTabletDriver) |
| **Power Plan** | **High performance** (`8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c`) |

---

## 1. Sơ Đồ Kết Nối Thiết Bị (USB / HID / Virtual Digitizer)

Khi XP-Pen Deco LW hoạt động hoàn chỉnh, Windows nhận đủ các thiết bị `Status = OK` sau:

1. **USB Composite Device**: `USB\VID_28BD&PID_0935\0000000000` (`usb.inf` v10.0.19041.4474)
2. **Interface `MI_00` (Kênh Phím tắt & Chuột)**:
   - `USB\VID_28BD&PID_0935&MI_00` (`HidUsb`)
   - `HID\VID_28BD&PID_0935&MI_00&COL01` (`HID-compliant mouse`)
   - `HID\VID_28BD&PID_0935&MI_00&COL02` (`HID-compliant mouse`)
   - `HID\VID_28BD&PID_0935&MI_00&COL03` (`HID Keyboard Device` — **kênh phím tắt Express Keys**)
3. **Interface `MI_01` (Kênh Bút HID gốc)**:
   - `USB\VID_28BD&PID_0935&MI_01` (`HidUsb`)
   - `HID\VID_28BD&PID_0935&MI_01` (`HID-compliant pen`, Usage `UP:000D_U:0002`)
4. **Interface `MI_02` (Kênh điều khiển của XPPen App)**:
   - `USB\VID_28BD&PID_0935&MI_02` (`HidUsb`)
   - `HID\VID_28BD&PID_0935&MI_02` (`HID-compliant vendor-defined device`, Usage `UP:FF0A_U:0001`)
5. **Virtual HID Driver của XP-Pen**:
   - `ROOT\HIDCLASS\0001` — FriendlyName: `XP-Pen Tablet`, HardwareId: `XPPen\PenTablet`, Service: `XPPenTablet`, INF: `oem54.inf` (`xppentablet.inf`, v`6.1.7600.16385`, 2023-09-19)
   - Các thiết bị con sinh ra từ `ROOT\HIDCLASS\0001`:
     - `HID\PENTABLET&COL03` (`HID-compliant digitizer`, `UP:000D_U:0001`)
     - `HID\PENTABLET&COL04` (`HID-compliant digitizer`, `UP:000D_U:0001`)
     - `HID\PENTABLET&COL05` (`HID-compliant vendor-defined device`, `UP:FF00_U:0001`)

---

## 2. Driver Store (`pnputil`), WinTab32.dll & System Drivers

- **Driver Store (OEM)**:
  - `oem54.inf` (`xppentablet.inf`) — `XPPen Technologies`, v`6.1.7600.16385` (09/19/2023)
  - `oem60.inf` (`hanvonugeemfilter.inf`) — `Hanvon Ugee Technology`, v`14.27.40.873` (05/25/2021)
- **WinTab32.dll**:
  - `C:\Windows\System32\Wintab32.dll`: 146,944 bytes, v`1.5.2.0`, 2023-09-19
  - `C:\Windows\SysWOW64\Wintab32.dll`: 126,464 bytes, v`1.5.2.0`, 2023-09-19
- **System32\drivers**:
  - `XPPenTablet.sys` (10,752 B, v`6.1.7600.16385`, WinDDK)
  - `hidkmdf.sys` (7,680 B, v`6.1.7600.16385`, WinDDK)
  - `hanvonugeemfilter.sys` (9,728 B, v`10.0.10011.16384`)

---

## 3. Windows Ink, Registry & Cấu hình `config.xml`

- `HKLM\SOFTWARE\Policies\Microsoft\WindowsInkWorkspace`: Không tồn tại (không bị chặn).
- `HKCU\Software\Microsoft\Windows\CurrentVersion\PenWorkspace`: `PenWorkspaceButtonDesiredVisibility = 1`.
- `HKLM\SOFTWARE\Microsoft\Windows\Tablet PC`: `IsTabletPC = 396`, `DeviceKind = 140`.
- `HKCU\Software\Microsoft\Wisp\Pen\SysEventParameters`: `EraseEnable=1`, `FlickMode=1`, `HoldMode=1`, `RightMaskEnable=1`.
- **File `%APPDATA%\XPPen\config.xml` (Profile `<Dec1013>` = Deco LW)**:
  - `<TablePC>1</TablePC>` (**Windows Ink = ON**)
  - `<RelativeCoords Speed="5">0</RelativeCoords>` (**Pen Mode / Tọa độ tuyệt đối**)
  - `<DisablePressure>0</DisablePressure>`, `<DisableSlope>0</DisableSlope>`, `<DisableQuickKey>0</DisableQuickKey>`
- **Log kết nối chuẩn (`%APPDATA%\XPPen\log.txt`)**:
  ```text
  Function  LoadConfig success
  Function  UpdateUIByAppChange: "Deco LW"
  Function nativeEvent usb: "\\?\HID#VID_28BD&PID_0935&MI_02#8&2b54a545&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}"  connected
  SentCmd-- 4
  ```

---

## 4. 7 Điểm Cần Kiểm Tra Xung Đột Trên Laptop

1. **Core Isolation / Memory Integrity (HVCI)**: Trên Windows 11, HVCI bật sẽ chặn `XPPenTablet.sys` / `hanvonugeemfilter.sys` (build Win7 DDK) → `ROOT\HIDCLASS\0001` lỗi, phím tắt `MI_00` vẫn chạy nhưng bút chết.
2. **USB Selective Suspend & Device Power Management (nguyên nhân phổ biến nhất gây mất bút sau 1–2 phút)**: Kiểm tra Power Options và bỏ tick *"Allow the computer to turn off this device to save power"* trên USB Root Hub, `VID_28BD` USB Input Devices và Bluetooth Adapter.
3. **Xung đột Driver hãng khác / Driver cũ**: Kiểm tra Wacom, Huion, Gaomon, OpenTabletDriver, bản XPPen v3 cũ, hoặc `Wintab32.dll` bị ghi đè.
4. **Màn hình cảm ứng / Bút tích hợp của Laptop**: Laptop 2-in-1 có sẵn `HID-compliant pen` / `I2C HID` có thể tranh chấp Windows Ink. Thử đổi `TablePC` (bật/tắt Windows Ink trong app XPPen).
5. **Bluetooth vs Cáp USB**: Nếu dùng Bluetooth trên Laptop, rất dễ rớt gói HID Pen sau 1–2 phút do driver Bluetooth/tiết kiệm pin/nhiễu 2.4GHz. Hãy test cắm trực tiếp cáp USB vào cổng trên thân máy.
6. **Services & Quyền Admin**: Đảm bảo `TabletInputService` (và `TextInputManagementService` trên Win 11) đang `Running`; kiểm tra xem app vẽ có chạy Admin trong khi `XPPenTablet.exe` chạy thường không.
7. **Kiểm tra `log.txt` của XPPen**: Đọc `%APPDATA%\XPPen\log.txt` ngay sau khi bút mất kết nối để xem có sự kiện `disconnected` hay lỗi mở cổng `MI_02` không.

---

## 5. Script PowerShell Chạy Trên Laptop (Dành cho Antigravity ở nhà)

```powershell
# Chạy trên Laptop ở nhà (PowerShell) để đối chiếu với PC chuẩn:
$ErrorActionPreference = 'SilentlyContinue'
Write-Output '=== 1. OS & HVCI ==='
Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber | Format-List
Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity' | Select-Object Enabled, WasEnabledBy | Format-List

Write-Output '=== 2. XP-PEN / PEN / DIGITIZER / CONFLICTS (PNP) ==='
Get-PnpDevice | Where-Object {
    $_.FriendlyName -match 'XP-Pen|XPPen|Deco|UGTABLET|Hanvon|Ugee|Wacom|Huion|Pen|Digitizer|Tablet|Stylus|Touch' -or
    $_.InstanceId -match 'VID_28BD|VID_5543|VID_056A|VID_256C|28BD'
} | Select-Object Status, Class, FriendlyName, InstanceId | Format-Table -AutoSize

Write-Output '=== 3. BLUETOOTH & USB (STATUS) ==='
Get-PnpDevice -Class Bluetooth | Select-Object Status, FriendlyName, InstanceId | Format-Table -AutoSize
Get-PnpDevice -Class USB -Status OK | Select-Object FriendlyName, InstanceId | Format-Table -AutoSize

Write-Output '=== 4. INSTALLED TABLET APPS & RUNNING PROCESSES ==='
Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' |
    Where-Object { $_.DisplayName -match 'XP-Pen|XPPen|Pentablet|Wacom|Huion|Ugee|Gaomon|Tablet|OpenTablet' } |
    Select-Object DisplayName, DisplayVersion, Publisher | Format-Table -AutoSize
Get-Process | Where-Object { $_.ProcessName -match 'Pen|XP|Tablet|Wacom|Huion|Ugee|Ink|TabTip|TextInput|OpenTablet' } |
    Select-Object Name, Id, Path, FileVersion | Format-Table -AutoSize

Write-Output '=== 5. SERVICES & WINTAB32.DLL ==='
Get-Service TabletInputService, TextInputManagementService, hidserv, bthserv | Select-Object Name, Status, StartType | Format-Table -AutoSize
Get-Item C:\Windows\System32\Wintab32.dll, C:\Windows\SysWOW64\Wintab32.dll |
    Select-Object FullName, Length, LastWriteTime, @{N='Version';E={$_.VersionInfo.FileVersion}}, @{N='Company';E={$_.VersionInfo.CompanyName}} | Format-List

Write-Output '=== 6. OEM TABLET DRIVERS (PNPUTIL) ==='
(pnputil /enum-drivers | Out-String) -split "(\r?\n){2,}" | Where-Object { $_ -match 'xppen|hanvon|ugee|wacom|huion|pentablet|tablet|28bd' }

Write-Output '=== 7. XPPEN CONFIG (Dec1013) & LOG TAIL ==='
if (Test-Path "$env:APPDATA\XPPen\config.xml") {
    [xml]$x = Get-Content "$env:APPDATA\XPPen\config.xml" -Encoding UTF8
    $x.PenTableLists.Dec1013.CommonAPP.Pen.OuterXml
}
if (Test-Path "$env:APPDATA\XPPen\log.txt") {
    Get-Content "$env:APPDATA\XPPen\log.txt" -Tail 30
}

Write-Output '=== 8. POWER PLAN & USB SELECTIVE SUSPEND ==='
powercfg /getactivescheme
powercfg /q SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226

```
