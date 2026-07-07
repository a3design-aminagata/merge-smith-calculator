const menuToggle = document.getElementById("menu-toggle");
const menuClose = document.getElementById("menu-close");
const sideMenu = document.getElementById("side-menu");
const menuBackdrop = document.getElementById("menu-backdrop");

function openMenu() {
  sideMenu.classList.add("open");
  menuBackdrop.classList.add("open");
}

function closeMenu() {
  sideMenu.classList.remove("open");
  menuBackdrop.classList.remove("open");
}

menuToggle.addEventListener("click", openMenu);
menuClose.addEventListener("click", closeMenu);
menuBackdrop.addEventListener("click", closeMenu);
