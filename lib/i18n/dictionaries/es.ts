import type { Dictionary } from "./en";

// Spanish UI strings. `satisfies Dictionary` makes a missing or extra key a compile error.
export const es = {
  nav: {
    teams: "Equipos",
    events: "Eventos",
    news: "Noticias",
    involved: "Participa",
    shop: "Tienda",
    about: "Nosotros",
    donate: "Apoya a la Federación",
    donateShort: "Apoya",
    menu: "Menú",
    toggle: "Mostrar u ocultar la navegación",
    primary: "Principal",
  },
  locale: {
    switcher: "Idioma",
    en: "Inglés",
    es: "Español",
  },
  footer: {
    homeLabel: "Federación de Sóftbol de las Islas Vírgenes de EE. UU. — inicio",
    contact: "Contacto",
    explore: "Explora",
    follow: "Síguenos",
    navLabel: "Pie de página",
    opensPaypal: "(abre PayPal)",
    tagline: "De las Islas Vírgenes al mundo.",
    rights: "Federación de Sóftbol de las Islas Vírgenes de EE. UU. Todos los derechos reservados.",
  },
} satisfies Dictionary;
