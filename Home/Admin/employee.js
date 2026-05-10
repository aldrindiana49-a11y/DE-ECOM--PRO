const employeeTabButtons = document.querySelectorAll(".employee-tab-btn");
const employeeTabContents = document.querySelectorAll(".employee-tab-content");

employeeTabButtons.forEach((button) => {
  button.addEventListener("click", () => {

    employeeTabButtons.forEach((btn) => {
      btn.classList.remove("active");
    });

    employeeTabContents.forEach((tab) => {
      tab.classList.remove("active-employee-tab");
    });

    button.classList.add("active");

    const target = button.dataset.employeeTab;

    document
      .getElementById(target)
      .classList.add("active-employee-tab");
  });
});

const employeeForm =
  document.getElementById("employeeForm");

const employeeCodeInput =
  document.getElementById("employeeCodeInput");

const employeeNameInput =
  document.getElementById("employeeNameInput");

const employeePositionInput =
  document.getElementById("employeePositionInput");

const employeeDailyRateInput =
  document.getElementById("employeeDailyRateInput");

const employeesTableBody =
  document.getElementById("employeesTableBody");

async function loadEmployees() {

  const { data, error } = await supabaseClient
    .from("employees")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {

    employeesTableBody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-box">
            No employees yet.
          </div>
        </td>
      </tr>
    `;

    return;
  }

  employeesTableBody.innerHTML = data.map((employee) => `
    <tr>
      <td>${employee.employee_code || ""}</td>
      <td>${employee.full_name || ""}</td>
      <td>${employee.position || ""}</td>
      <td>
        ₱${Number(employee.daily_rate || 0).toLocaleString()}
      </td>
      <td>
        <span class="employee-status status-working">
          ${employee.status || "active"}
        </span>
      </td>
    </tr>
  `).join("");
}

if (employeeForm) {

  employeeForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const employeeData = {
      employee_code: employeeCodeInput.value.trim(),
      full_name: employeeNameInput.value.trim(),
      position: employeePositionInput.value.trim(),
      daily_rate: Number(employeeDailyRateInput.value || 0),
      status: "active"
    };

    const { error } = await supabaseClient
      .from("employees")
      .insert([employeeData]);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    alert("Employee saved.");

    employeeForm.reset();

    loadEmployees();

    loadAttendanceEmployeeOptions();
  });
}

const manualAttendanceForm =
  document.getElementById("manualAttendanceForm");

const manualAttendanceEmployee =
  document.getElementById("manualAttendanceEmployee");

const manualAttendanceDate =
  document.getElementById("manualAttendanceDate");

const manualTimeIn =
  document.getElementById("manualTimeIn");

const manualTimeOut =
  document.getElementById("manualTimeOut");

const manualAttendanceStatus =
  document.getElementById("manualAttendanceStatus");

const manualAttendanceNotes =
  document.getElementById("manualAttendanceNotes");

async function loadAttendanceEmployeeOptions() {

  const { data, error } = await supabaseClient
    .from("employees")
    .select("*")
    .order("full_name", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  if (manualAttendanceEmployee) {

    manualAttendanceEmployee.innerHTML =
      `<option value="">Select employee</option>`;

    data.forEach((employee) => {

      manualAttendanceEmployee.innerHTML += `
        <option value="${employee.id}">
          ${employee.full_name}
        </option>
      `;
    });
  }

  const payslipEmployeeSelect =
    document.getElementById("payslipEmployeeSelect");

  if (payslipEmployeeSelect) {

    payslipEmployeeSelect.innerHTML =
      `<option value="">Select employee</option>`;

    data.forEach((employee) => {

      payslipEmployeeSelect.innerHTML += `
        <option value="${employee.id}">
          ${employee.full_name}
        </option>
      `;
    });
  }
}

if (manualAttendanceForm) {

  manualAttendanceForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const attendanceData = {
      employee_id: manualAttendanceEmployee.value,
      attendance_date: manualAttendanceDate.value,
      time_in: manualTimeIn.value,
      time_out: manualTimeOut.value,
      status: manualAttendanceStatus.value,
      notes: manualAttendanceNotes.value,
      source: "manual"
    };

    const { error } = await supabaseClient
      .from("attendance_logs")
      .insert([attendanceData]);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    alert("Attendance saved.");

    manualAttendanceForm.reset();
  });
}

loadAttendanceEmployeeOptions();

loadEmployees();