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

<script src="./employee.js"></script>