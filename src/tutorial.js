console.log("tutorial.js loaded");
var thing = document.getElementById("instruction");
var escapeThing = document.getElementById("fittslaw");
escapeThing.addEventListener('click', function() {
  thing.style.display = 'none';
});
