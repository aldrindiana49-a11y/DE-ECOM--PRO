const categories = [

  {
    name: "Power Amplifier",
    icon: "🔊",
    desc: "High quality amplifier boards and modules."
  },

  {
    name: "Speaker & Tweeter",
    icon: "🎵",
    desc: "Speakers, tweeters, and audio drivers."
  },

  {
    name: "Audio Processor",
    icon: "🎚️",
    desc: "Processors and audio enhancement tools."
  },

  {
    name: "Transistor / MOSFET",
    icon: "⚡",
    desc: "MOSFETs, transistors, and power components."
  },

  {
    name: "Capacitor",
    icon: "🔋",
    desc: "Capacitors for repair and electronics builds."
  },

  {
    name: "PCB / Boards",
    icon: "💻",
    desc: "PCB boards and electronic modules."
  },

  {
    name: "Wires & Cables",
    icon: "🔌",
    desc: "Audio wires, power cables, and connectors."
  },

  {
    name: "Others",
    icon: "🛠️",
    desc: "More electronics parts and accessories."
  }

];

const categoriesGrid =
  document.getElementById("categoriesGrid");

categories.forEach(category => {

  const card =
    document.createElement("div");

  card.className =
    "category-card";

  card.innerHTML = `
    <div class="category-icon">
      ${category.icon}
    </div>

    <h3>
      ${category.name}
    </h3>

    <p>
      ${category.desc}
    </p>
  `;

  card.onclick = () => {

    localStorage.setItem(
      "selectedCategory",
      category.name
    );

    window.location.href =
      "../";

  };

  categoriesGrid.appendChild(card);

});