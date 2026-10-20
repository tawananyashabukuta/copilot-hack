import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowRight, ArrowUpRight, Bath, BedDouble, CalendarDays,
  Check, ChevronDown, ChevronLeft, ChevronRight, Compass, House, MapPin, Menu, MessageCircle,
  Minus, Mountain, Plus, RefreshCw, Send, ShieldCheck, Sparkles, Users, Waves, X,
} from "lucide-react";
import { supabase } from "./supabase.js";

const ADMIN_EMAILS = [
  "tawananyashabukuta8@gmail.com",
  "stay@unileisure.co.zw",
];
const normalizeEmail = (email) => email?.trim().toLowerCase() || "";
const ADMIN_PATH = "/stay-control-877adee6faa6bab4765d2ad2115254f38c4e";
const WHATSAPP_NUMBER = import.meta.env.VITE_OWNER_WHATSAPP || "263772136751";
const properties = {
  clandstein: {
    name: "CLANDSTEIN Houseboat",
    location: "Lake Kariba, Zimbabwe",
    maxGuests: 6,
    minimumNights: 3,
  },
  coates: {
    name: "Coates Cottage",
    location: "Connemara, Nyanga",
    maxGuests: 11,
    minimumNights: 1,
  },
};

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function prettyDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function whatsappLink(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function ownerBookingMessage({ name, phone, stayName, checkIn, checkOut, guests }) {
  return [
    "NEW UNILEISURE BOOKING",
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Property: ${stayName}`,
    `Dates: ${prettyDate(checkIn)} to ${prettyDate(checkOut)}`,
    `Guests: ${guests}`,
    "Total: To be confirmed",
    "Please confirm.",
  ].join("\n");
}

async function fetchAllBookings() {
  const pageSize = 500;
  const allBookings = [];

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from("bookings")
      .select("id, houseboat_name, name, email, phone, guests, check_in, check_out, created_at")
      .order("created_at", { ascending: false })
      .range(start, start + pageSize - 1);
    if (error) return { data: null, error };
    allBookings.push(...data);
    if (data.length < pageSize) return { data: allBookings, error: null };
  }
}

async function requestAvailability(property, checkIn, checkOut) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("check_booking_availability", {
    p_property_id: property,
    p_check_in: checkIn,
    p_check_out: checkOut,
  });
  if (error) throw error;
  return data === true;
}

async function insertBooking({ name, email, phone, property, guests, checkIn, checkOut }) {
  if (!supabase) throw new Error("Supabase is not configured. Please use Enquire on WhatsApp.");
  const { data, error } = await supabase.rpc("create_booking", {
    p_property_id: property,
    p_guest_name: name,
    p_guest_email: email,
    p_guest_phone: phone,
    p_guest_count: guests,
    p_check_in: checkIn,
    p_check_out: checkOut,
  });
  if (error) throw error;
  if (typeof data !== "string" || !data) {
    throw new Error("The database did not confirm that the booking was saved.");
  }
  return data;
}

function Brand({ light = false }) {
  return (
    <a className={`brand${light ? " brand-light" : ""}`} href="#home" aria-label="Stay at UniLeisure home">
      <span className="brand-mark"><Mountain size={21} strokeWidth={1.8} /></span>
      <span className="brand-name">stay at <strong>unileisure</strong></span>
    </a>
  );
}

function BookingForm({ initialProperty = "clandstein" }) {
  const [property, setProperty] = useState(initialProperty);
  const [checkIn, setCheckIn] = useState(dateOffset(14));
  const [checkOut, setCheckOut] = useState(dateOffset(17));
  const [guests, setGuests] = useState(2);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [bookingConfirmation, setBookingConfirmation] = useState(null);
  const stay = properties[property];

  function changeProperty(nextProperty) {
    setProperty(nextProperty);
    setGuests((value) => Math.min(value, properties[nextProperty].maxGuests));
  }

  useEffect(() => {
    function handlePropertyChange(event) {
      if (Object.prototype.hasOwnProperty.call(properties, event.detail)) changeProperty(event.detail);
    }
    window.addEventListener("select-stay", handlePropertyChange);
    return () => window.removeEventListener("select-stay", handlePropertyChange);
  }, []);

  function validateBooking() {
    setMessage("");
    if (new Date(checkOut) <= new Date(checkIn)) {
      setMessage("Please choose a check-out date after your arrival.");
      return false;
    }
    const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
    if (nights < stay.minimumNights) {
      setMessage(`${stay.name} has a minimum stay of ${stay.minimumNights} nights.`);
      return false;
    }
    if (guests > stay.maxGuests) {
      setMessage(`This stay accommodates up to ${stay.maxGuests} guests.`);
      return false;
    }
    return true;
  }

  async function enquireOnWhatsApp(event) {
    if (!event.currentTarget.form.reportValidity() || !validateBooking()) return;
    const ownerLink = whatsappLink(ownerBookingMessage({
      name: name.trim(),
      phone: phone.trim(),
      stayName: stay.name,
      checkIn,
      checkOut,
      guests,
    }));
    setCheckingAvailability(true);
    try {
      if (!(await requestAvailability(property, checkIn, checkOut))) {
        setMessage("The following dates are booked. Please choose different dates or contact the owner.");
        return;
      }
    } catch (availabilityError) {
      console.error("Could not check booking availability:", availabilityError);
    } finally {
      setCheckingAvailability(false);
    }
    window.location.assign(ownerLink);
  }

  async function submitBooking(event) {
    event.preventDefault();
    setBookingConfirmation(null);
    if (!validateBooking()) return;

    const booking = {
      name: name.trim(),
      phone: phone.trim(),
      stayName: stay.name,
      checkIn,
      checkOut,
      guests,
    };
    const ownerLink = whatsappLink(ownerBookingMessage(booking));
    setBusy(true);
    try {
      if (!(await requestAvailability(property, checkIn, checkOut))) {
        setMessage("The following dates are booked. Please choose different dates or enquire on WhatsApp.");
        return;
      }
      const bookingId = await insertBooking({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        property,
        guests,
        checkIn,
        checkOut,
      });
      setBookingConfirmation({ ...booking, bookingId, ownerLink });
    } catch (error) {
      console.error("Booking request could not be saved:", error);
      setMessage(`${error.message || "We couldn't save your request."} Please try again or enquire on WhatsApp.`);
    } finally {
      setBusy(false);
    }
  }

  if (bookingConfirmation) {
    return (
      <div className="booking-success" role="status">
        <div className="booking-success-icon"><Check size={25} /></div>
        <span className="eyebrow">Booking request saved</span>
        <h3>Thanks, your request is with us.</h3>
        <p>No payment has been taken. Send the WhatsApp message so the owner can confirm your dates and payment.</p>
        <div className="booking-success-summary">
          <span><strong>Stay</strong>{bookingConfirmation.stayName}</span>
          <span><strong>Dates</strong>{prettyDate(bookingConfirmation.checkIn)} – {prettyDate(bookingConfirmation.checkOut)}</span>
          <span><strong>Guests</strong>{bookingConfirmation.guests}</span>
          <span><strong>Price</strong>To be confirmed by owner</span>
          <span><strong>Request status</strong>Saved to booking records</span>
        </div>
        <a className="button button-primary booking-success-action" href={bookingConfirmation.ownerLink} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={17} /> Send WhatsApp to Owner <ArrowUpRight size={16} />
        </a>
        <button className="booking-again" type="button" onClick={() => setBookingConfirmation(null)}>Make another enquiry</button>
      </div>
    );
  }

  return (
    <form className="booking-form" onSubmit={submitBooking}>
      <div className="form-grid">
        <label className="field field-property">
          <span>Choose your stay</span>
          <span className="select-wrap">
            <House size={17} />
            <select value={property} onChange={(event) => changeProperty(event.target.value)}>
              <option value="clandstein">CLANDSTEIN Houseboat</option>
              <option value="coates">Coates Cottage</option>
            </select>
            <ChevronDown className="select-chevron" size={15} />
          </span>
        </label>
        <label className="field">
          <span>Check in</span>
          <span className="input-wrap"><CalendarDays size={17} /><input required type="date" min={dateOffset(0)} value={checkIn} onChange={(event) => setCheckIn(event.target.value)} /></span>
        </label>
        <label className="field">
          <span>Check out</span>
          <span className="input-wrap"><CalendarDays size={17} /><input required type="date" min={checkIn || dateOffset(0)} value={checkOut} onChange={(event) => setCheckOut(event.target.value)} /></span>
        </label>
        <label className="field field-guests">
          <span>Guests</span>
          <span className="guest-control">
            <button aria-label="Remove one guest" type="button" onClick={() => setGuests((value) => Math.max(1, value - 1))}><Minus size={15} /></button>
            <span><Users size={16} /> {guests}</span>
            <button aria-label="Add one guest" type="button" onClick={() => setGuests((value) => Math.min(stay.maxGuests, value + 1))}><Plus size={15} /></button>
          </span>
        </label>
      </div>
      <div className="form-grid form-grid-contact">
        <label className="field"><span>Your name</span><input required autoComplete="name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" /></label>
        <label className="field"><span>Email address</span><input required type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label className="field"><span>WhatsApp / phone</span><input required type="tel" autoComplete="tel" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+263 ..." /></label>
        <div className="booking-actions">
          <button className="button button-outline booking-whatsapp-button" type="button" disabled={checkingAvailability || busy} onClick={enquireOnWhatsApp}>
            <MessageCircle size={16} /> {checkingAvailability ? "Checking dates…" : "Enquire on WhatsApp"}
          </button>
          <button className="button button-primary booking-submit" disabled={busy || checkingAvailability} type="submit">
            {busy ? "Saving…" : "Book"} <ArrowUpRight size={17} />
          </button>
        </div>
      </div>
      <div className="form-foot">
        <span><ShieldCheck size={15} /> No online payment. Confirm details with our team on WhatsApp.</span>
        <span>Up to {stay.maxGuests} guests · min. {stay.minimumNights} nights</span>
      </div>
      {message && <p className="form-message" role="alert">{message}</p>}
    </form>
  );
}

function BookingSection({ initialProperty }) {
  return (
    <section className="booking-section" id="booking">
      <div className="booking-heading">
        <div><span className="eyebrow">Your next escape starts here</span><h2>Find your kind of <em>away.</em></h2></div>
        <p>Tell us a little about your stay. We’ll check availability together on WhatsApp.</p>
      </div>
      <BookingForm initialProperty={initialProperty} />
    </section>
  );
}

function KaribaSection() {
  return (
    <section className="stay-section kariba-section" id="kariba">
      <div className="stay-image-wrap">
        <img className="stay-image" src="https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1500&q=85" alt="Golden evening light on a peaceful lake" loading="lazy" />
        <div className="image-caption"><Waves size={16} /> LAKE KARIBA, ZIMBABWE</div>
        <div className="image-number">01 <span>/ 02</span></div>
      </div>
      <div className="stay-copy">
        <span className="eyebrow">A slower kind of adventure</span>
        <h2>CLANDSTEIN<br /><em>Houseboat</em></h2>
        <p className="lead">Leave the ordinary behind and experience the tranquillity of Lake Kariba aboard CLANDSTEIN Houseboat.</p>
        <p>Whether you’re planning a family holiday, a fishing getaway, a corporate retreat or a relaxing weekend with friends, CLANDSTEIN offers the perfect setting to unwind, reconnect and create unforgettable memories.</p>
        <div className="amenity-grid">
          <span><BedDouble /> <strong>2 cabins</strong><small>Sleeps up to 6</small></span>
          <span><Users /> <strong>Cook included</strong><small>Relax from day one</small></span>
          <span><Waves /> <strong>Tender boat</strong><small>Included with your stay</small></span>
          <span><House /> <strong>Self-catering</strong><small>Make yourself at home</small></span>
        </div>
        <div className="perfect-for"><span className="eyebrow">Made for</span><div><span>Family holidays</span><span>Fishing getaways</span><span>Weekend escapes</span></div></div>
        <div className="rate-card">
          <div><span>From</span><strong>$350 <small>/ night</small></strong><span>Off-peak · dry rate</span></div>
          <div><span>Peak season · dry rate</span><strong>$550 <small>/ night</small></strong><span>Minimum stay 3 nights</span></div>
          <a className="text-link" href="#booking" onClick={() => window.dispatchEvent(new CustomEvent("select-stay", { detail: "clandstein" }))}>Ask about dates <ArrowRight size={16} /></a>
        </div>
      </div>
    </section>
  );
}

const boatPhotos = [
  {
    src: "/images/clandstein-houseboat.jpg",
    alt: "CLANDSTEIN houseboat floating peacefully on Lake Kariba",
    caption: "CLANDSTEIN on the water",
    className: "boat-photo-featured",
  },
  {
    src: "/images/clandstein-on-kariba.jpg",
    alt: "A closer view of the houseboat moored on Lake Kariba",
    caption: "A closer look aboard",
    className: "",
  },
  {
    src: "/images/kariba-tender-at-sunset.jpg",
    alt: "Tender boats on Lake Kariba in the warm evening light",
    caption: "Evenings on the lake",
    className: "",
  },
  {
    src: "/images/clandstein-dining-deck.jpg",
    alt: "Outdoor dining table and comfortable seating on the CLANDSTEIN houseboat deck",
    caption: "Dine out on the water",
    className: "",
  },
];

const cottagePhotos = [
  {
    src: "/images/coates-cottage.jpg",
    alt: "The exterior of Coates Cottage surrounded by its garden and Nyanga trees",
    caption: "Welcome to Coates Cottage",
    className: "cottage-photo-featured",
  },
  {
    src: "/images/coates-lounge-dining.jpg",
    alt: "The open-plan lounge and dining space at Coates Cottage",
    caption: "Room for everyone",
    className: "",
  },
  {
    src: "/images/coates-garden-room.jpg",
    alt: "A comfortable sitting and dining area looking out to the cottage garden",
    caption: "A garden-side moment",
    className: "",
  },
  {
    src: "/images/coates-fireplace.jpg",
    alt: "The warm fireplace and wood-burning stove at Coates Cottage",
    caption: "Cosy up by the fire",
    className: "",
  },
];

function BoatGallery() {
  const [activePhoto, setActivePhoto] = useState(null);

  useEffect(() => {
    if (activePhoto === null) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") setActivePhoto(null);
      if (event.key === "ArrowRight") setActivePhoto((index) => (index + 1) % boatPhotos.length);
      if (event.key === "ArrowLeft") setActivePhoto((index) => (index + boatPhotos.length - 1) % boatPhotos.length);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePhoto]);

  return (
    <>
      <section className="boat-gallery" aria-labelledby="boat-gallery-title">
        <div className="gallery-heading">
          <div><span className="eyebrow">A little closer to the water</span><h2 id="boat-gallery-title">Take a look <em>around.</em></h2></div>
          <p>Lake days, open skies and a closer look at your Kariba escape.</p>
        </div>
        <div className="boat-gallery-grid">
          {boatPhotos.map((photo, index) => (
            <button className={`boat-gallery-photo ${photo.className}`} key={photo.src} onClick={() => setActivePhoto(index)} aria-label={`View photo: ${photo.caption}`}>
              <img src={photo.src} alt={photo.alt} loading="lazy" />
              <span className="boat-photo-caption">{photo.caption}<ArrowUpRight size={16} /></span>
            </button>
          ))}
        </div>
      </section>
      {activePhoto !== null && (
        <div className="lightbox-backdrop" role="dialog" aria-modal="true" aria-label="CLANDSTEIN photo gallery" onMouseDown={(event) => { if (event.target === event.currentTarget) setActivePhoto(null); }}>
          <button className="lightbox-close" onClick={() => setActivePhoto(null)} aria-label="Close photo gallery"><X size={22} /></button>
          <button className="lightbox-arrow lightbox-previous" onClick={() => setActivePhoto((index) => (index + boatPhotos.length - 1) % boatPhotos.length)} aria-label="Previous photo"><ChevronLeft size={26} /></button>
          <figure className="lightbox-figure">
            <img src={boatPhotos[activePhoto].src} alt={boatPhotos[activePhoto].alt} />
            <figcaption><span>{boatPhotos[activePhoto].caption}</span><small>{activePhoto + 1} / {boatPhotos.length}</small></figcaption>
          </figure>
          <button className="lightbox-arrow lightbox-next" onClick={() => setActivePhoto((index) => (index + 1) % boatPhotos.length)} aria-label="Next photo"><ChevronRight size={26} /></button>
        </div>
      )}
    </>
  );
}

function CottageGallery() {
  const [activePhoto, setActivePhoto] = useState(null);

  useEffect(() => {
    function openFeaturedPhoto() {
      setActivePhoto(0);
    }
    window.addEventListener("open-cottage-photo", openFeaturedPhoto);
    return () => window.removeEventListener("open-cottage-photo", openFeaturedPhoto);
  }, []);

  useEffect(() => {
    if (activePhoto === null) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") setActivePhoto(null);
      if (event.key === "ArrowRight") setActivePhoto((index) => (index + 1) % cottagePhotos.length);
      if (event.key === "ArrowLeft") setActivePhoto((index) => (index + cottagePhotos.length - 1) % cottagePhotos.length);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePhoto]);

  return (
    <>
      <section className="cottage-gallery" aria-labelledby="cottage-gallery-title">
        <div className="cottage-gallery-heading"><span className="eyebrow">A closer look at your highland hideaway</span><h2 id="cottage-gallery-title">Make yourself <em>at home.</em></h2><p>Explore the cottage, settle into the lounge and picture a cosy evening in.</p></div>
        <div className="cottage-gallery-grid">
          {cottagePhotos.map((photo, index) => (
            <button className={`cottage-gallery-photo ${photo.className}`} key={photo.src} onClick={() => setActivePhoto(index)} aria-label={`View photo: ${photo.caption}`}>
              <img src={photo.src} alt={photo.alt} loading="lazy" />
              <span className="cottage-photo-caption">{photo.caption}<ArrowUpRight size={16} /></span>
            </button>
          ))}
        </div>
      </section>
      {activePhoto !== null && (
        <div className="lightbox-backdrop" role="dialog" aria-modal="true" aria-label="Coates Cottage photo gallery" onMouseDown={(event) => { if (event.target === event.currentTarget) setActivePhoto(null); }}>
          <button className="lightbox-close" onClick={() => setActivePhoto(null)} aria-label="Close photo gallery"><X size={22} /></button>
          <button className="lightbox-arrow lightbox-previous" onClick={() => setActivePhoto((index) => (index + cottagePhotos.length - 1) % cottagePhotos.length)} aria-label="Previous photo"><ChevronLeft size={26} /></button>
          <figure className="lightbox-figure">
            <img src={cottagePhotos[activePhoto].src} alt={cottagePhotos[activePhoto].alt} />
            <figcaption><span>{cottagePhotos[activePhoto].caption}</span><small>{activePhoto + 1} / {cottagePhotos.length}</small></figcaption>
          </figure>
          <button className="lightbox-arrow lightbox-next" onClick={() => setActivePhoto((index) => (index + 1) % cottagePhotos.length)} aria-label="Next photo"><ChevronRight size={26} /></button>
        </div>
      )}
    </>
  );
}

function CottageMap() {
  return (
    <div className="map-card" aria-label="Illustrated location map of Coates Cottage in Connemara, Nyanga">
      <div className="map-top"><span className="map-pin"><MapPin size={17} /></span><span><strong>CONNEMARA, NYANGA</strong><small>Eastern Highlands, Zimbabwe</small></span><Compass className="map-compass" size={23} /></div>
      <svg className="map-art" viewBox="0 0 540 250" role="img" aria-label="Walking route from Coates Cottage to Connemara Dam and World's View">
        <path className="map-water" d="M-10 38 C48 28 52 82 100 82 C145 82 155 39 197 47 C234 55 226 95 269 96 C319 97 324 34 377 44 C423 53 416 105 466 111 C499 115 523 97 550 100 L550 158 C505 162 488 180 452 174 C405 166 401 138 360 136 C312 134 300 185 254 176 C214 168 211 129 169 127 C120 124 113 164 70 155 C34 148 23 115 -10 120Z" />
        <path className="map-trail" d="M82 213 C130 196 151 194 185 171 S233 144 254 136 S300 117 322 93" />
        <path className="map-road" d="M-10 228 C68 193 110 236 171 208 S255 211 308 179 S404 190 454 150 S513 123 551 136" />
        <path className="map-road-edge" d="M-10 228 C68 193 110 236 171 208 S255 211 308 179 S404 190 454 150 S513 123 551 136" />
        <path className="map-road-inner" d="M-10 228 C68 193 110 236 171 208 S255 211 308 179 S404 190 454 150 S513 123 551 136" />
        <circle className="map-dot cottage-dot" cx="82" cy="213" r="8" /><circle className="map-dot dam-dot" cx="322" cy="93" r="8" /><circle className="map-dot view-dot" cx="454" cy="150" r="8" />
        <text className="map-label" x="32" y="191">COATES COTTAGE</text><text className="map-label" x="286" y="68">CONNEMARA DAM</text><text className="map-label" x="407" y="128">WORLD'S VIEW</text>
        <text className="map-distance" x="177" y="143">a short walk</text><text className="map-distance" x="370" y="213">1 km</text>
      </svg>
      <div className="map-legend"><span><i className="legend-dot green" /> Coates Cottage</span><span><i className="legend-dot blue" /> Dam & viewpoints</span><span><i className="legend-line" /> Scenic walking route</span></div>
    </div>
  );
}

function CottageSection() {
  return (
    <>
    <section className="stay-section cottage-section" id="nyanga">
      <div className="stay-copy cottage-copy">
        <span className="eyebrow">Breathe in the highlands</span>
        <h2>Coates Cottage<br /><em>Connemara, Nyanga</em></h2>
        <p className="lead">Surrounded by natural beauty and fresh mountain air, Coates Cottage is the ideal place to relax, unwind and make lasting memories with family and friends.</p>
        <div className="cottage-specs"><span><BedDouble /> 4 bedrooms</span><span><Bath /> 3 bathrooms</span><span><Users /> Sleeps 11 sharing</span><span><House /> Self-catering</span></div>
        <ul className="feature-list">
          <li><Check /> Fully equipped self-catering kitchen</li>
          <li><Check /> Spacious open-plan lounge & dining area</li>
          <li><Check /> Outdoor braai & entertainment area</li>
          <li><Check /> Wood-fired hot tub and beautiful garden</li>
          <li><Check /> Close to Connemara Dam and walking-distance scenic trails</li>
        </ul>
        <CottageMap />
        <a className="button button-primary cottage-cta" href="#booking" onClick={() => window.dispatchEvent(new CustomEvent("select-stay", { detail: "coates" }))}>Plan your mountain escape <ArrowRight size={17} /></a>
      </div>
      <div className="cottage-visual">
        <button className="cottage-feature-frame" onClick={() => window.dispatchEvent(new CustomEvent("open-cottage-photo", { detail: 0 }))} aria-label="View the Coates Cottage exterior photo">
          <img src="/images/coates-cottage.jpg" alt="The exterior of Coates Cottage surrounded by its garden and Nyanga trees" loading="lazy" />
          <span className="cottage-frame-note"><Mountain size={18} /><span>YOUR HIGHLAND HIDEAWAY<br /><strong>CONNEMARA, NYANGA</strong></span></span>
          <span className="cottage-frame-caption"><MapPin size={15} /> COATES COTTAGE · NYANGA, ZIMBABWE</span>
          <span className="cottage-frame-open"><ArrowUpRight size={18} /></span>
        </button>
      </div>
    </section>
    <CottageGallery />
    </>
  );
}

function Concierge() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([{ role: "assistant", content: "Hello! I’m your Stay at UniLeisure concierge. Ask me about our stays, amenities, rates or getting here." }]);
  const bottomRef = useRef(null);
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, open]);

  async function sendMessage(text = input) {
    const question = text.trim();
    if (!question || busy) return;
    const history = [...messages, { role: "user", content: question }];
    setMessages(history);
    setInput("");
    setBusy(true);
    try {
      if (!supabase) throw new Error("Concierge is not configured yet.");
      const { data, error } = await supabase.functions.invoke("concierge", {
        body: { messages: history.slice(-8).map(({ role, content }) => ({ role, content })) },
      });
      if (error) throw error;
      setMessages([...history, { role: "assistant", content: data.answer }]);
    } catch {
      setMessages([...history, { role: "assistant", content: "I’m having trouble connecting just now. Our team can help you directly on WhatsApp." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="concierge">
      {open && <section className="chat-panel" aria-label="Stay concierge chat">
        <header className="chat-header"><div className="chat-avatar"><Sparkles size={18} /></div><div><strong>Your stay, sorted.</strong><small>Stay at UniLeisure concierge</small></div><button aria-label="Close chat" onClick={() => setOpen(false)}><X size={18} /></button></header>
        <div className="chat-messages">
          {messages.map((item, index) => <div key={`${item.role}-${index}`} className={`chat-message ${item.role}`}>{item.content}</div>)}
          {busy && <div className="chat-message assistant typing">Finding the right details…</div>}
          <div ref={bottomRef} />
        </div>
        {messages.length === 1 && <div className="chat-prompts">{["Tell me about Nyanga", "Houseboat rates", "What’s included?"].map((prompt) => <button key={prompt} onClick={() => sendMessage(prompt)}>{prompt}</button>)}</div>}
        <form className="chat-input" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}><input aria-label="Ask a question" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask us anything…" maxLength={500} /><button aria-label="Send message" disabled={busy || !input.trim()}><Send size={17} /></button></form>
        <a className="chat-whatsapp" href={whatsappLink("Hello! I have a question about staying with UniLeisure.")} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Prefer WhatsApp? Chat to our team</a>
      </section>}
      <button className={`chat-launcher${open ? " is-open" : ""}`} aria-label={open ? "Close concierge chat" : "Open concierge chat"} onClick={() => setOpen(!open)}>
        {open ? <X size={21} /> : <><span className="launcher-spark"><Sparkles size={16} /></span><span>Ask our concierge</span><MessageCircle size={18} /></>}
      </button>
    </div>
  );
}

function AdminPanel() {
  const [email, setEmail] = useState(ADMIN_EMAILS[0]);
  const [password, setPassword] = useState("");
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [property, setProperty] = useState("clandstein");
  const [blockedOn, setBlockedOn] = useState(dateOffset(1));
  const [blockedFrom, setBlockedFrom] = useState(dateOffset(1));
  const [blockedTo, setBlockedTo] = useState(dateOffset(1));
  const [blockedDates, setBlockedDates] = useState([]);
  const [availabilityBlocks, setAvailabilityBlocks] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingsError, setBookingsError] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const [dataRefresh, setDataRefresh] = useState(0);

  useEffect(() => {
    if (!supabase) return undefined;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
  if (cancelled) return;
  const email = normalizeEmail(data.session?.user?.email);
  if (data.session && ADMIN_EMAILS.map(normalizeEmail).includes(email)) {
    setSession(data.session);
  } else if (data.session) {
    // supabase.auth.signOut();
  }
    }).catch((sessionError) => {
      if (!cancelled) setError(sessionError.message || "Could not connect to admin sign-in. Check the Supabase project URL and try again.");
    });
   const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
  setSession(newSession);
});    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    async function loadAdminData() {
      setLoadingData(true);
      setError("");
      setBookingsError("");
      try {
        const [datesResult, blocksResult, bookingResult] = await Promise.all([
          supabase.from("blocked_dates").select("property_id, blocked_on").order("blocked_on", { ascending: true }).limit(200),
          supabase.from("availability_blocks").select("id, property_id, check_in, check_out").order("check_in", { ascending: true }).limit(200),
          fetchAllBookings(),
        ]);
        if (cancelled) return;
        if (datesResult.error) setError(`Could not load blocked dates: ${datesResult.error.message}`);
        else setBlockedDates(datesResult.data);
        if (blocksResult.error) {
          setError((current) => current
            ? `${current} Could not load date ranges: ${blocksResult.error.message}`
            : `Could not load date ranges: ${blocksResult.error.message}`);
        } else {
          setAvailabilityBlocks(blocksResult.data);
        }
        if (bookingResult.error) {
          setBookings([]);
          setBookingsError(`Could not load bookings from Supabase: ${bookingResult.error.message}`);
        } else {
          setBookings(bookingResult.data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setBookings([]);
          setBookingsError(`Could not load bookings from Supabase: ${loadError.message || "request failed"}`);
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }
    loadAdminData();
    return () => { cancelled = true; };
  }, [session, dataRefresh]);

  async function signIn(event) {
    event.preventDefault();
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!ADMIN_EMAILS.includes(normalizedEmail)) {
      setError("This email address is not authorised for admin access.");
      return;
    }
    if (!supabase) {
      setError("Admin access is not configured. Add the Supabase settings from .env.example first.");
      return;
    }
    setBusy(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (authError) {
        setError(authError.message === "Invalid login credentials"
          ? "The email or password is incorrect. Check your details or reset this account’s password in Supabase."
          : authError.message);
      } else {
        const authenticatedEmail = normalizeEmail(data.user?.email);
        console.info("[admin-auth] Allowlist check", {
          email: authenticatedEmail || "(missing)",
          allowedEmails: ADMIN_EMAILS,
        });
        if (!ADMIN_EMAILS.includes(authenticatedEmail)) {
          await supabase.auth.signOut();
          setError("This account is not authorised for admin access.");
        } else {
          setSession(data.session);
          setPassword("");
        }
      }
    } catch (requestError) {
      console.error("Admin password sign-in failed:", requestError);
      setError(requestError.message?.includes("Failed to fetch")
        ? "Could not reach Supabase. Check the project URL and your internet connection, then try again."
        : requestError.message || "We couldn't sign you in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function addBlockedDate(event) {
    event.preventDefault();
    setError("");
    const { error: saveError } = await supabase.from("blocked_dates").insert({ property_id: property, blocked_on: blockedOn });
    if (saveError) {
      setError(saveError.code === "23505" ? "That date is already blocked." : saveError.message);
      return;
    }
    setBlockedDates((dates) => [...dates, { property_id: property, blocked_on: blockedOn }].sort((a, b) => a.blocked_on.localeCompare(b.blocked_on)));
  }

  async function removeBlockedDate(date) {
    setError("");
    const { error: removeError } = await supabase.from("blocked_dates").delete().eq("property_id", date.property_id).eq("blocked_on", date.blocked_on);
   if (removeError) setError(removeError.message);
    else setBlockedDates((dates) => dates.filter((item) => item.property_id !== date.property_id || item.blocked_on !== date.blocked_on));
  }

  async function addAvailabilityBlock(event) {
    event.preventDefault();
    setError("");
    if (blockedTo < blockedFrom) {
      setError("The end date must be the same as or later than the start date.");
      return;
    }
    const { data, error: saveError } = await supabase.from("availability_blocks")
      .insert({ property_id: property, check_in: blockedFrom, check_out: blockedTo })
      .select("id, property_id, check_in, check_out")
      .single();
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setAvailabilityBlocks((blocks) => [...blocks, data].sort((a, b) => a.check_in.localeCompare(b.check_in)));
  }

  async function removeAvailabilityBlock(block) {
    setError("");
    const { data, error: removeError } = await supabase.from("availability_blocks")
      .delete()
      .eq("id", block.id)
      .select("id");
    if (removeError) {
      setError(removeError.message);
    } else if (!data?.length) {
      setError("The date range was not removed. Check that you are signed in as an authorised admin.");
    } else {
      setAvailabilityBlocks((blocks) => blocks.filter((item) => item.id !== block.id));
    }
  }

  async function signOut() {
    const { error: authError } = await supabase.auth.signOut();
    if (authError) setError(authError.message);
    else setSession(null);
  }

  return (
    <div className="modal-backdrop">
      <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-title">
        <header className="admin-top"><Brand /></header>
        {!session ? <div className="admin-login">
          <div className="admin-lock"><ShieldCheck size={25} /></div>
          <span className="eyebrow">Private access</span><h2 id="admin-title">Admin sign in</h2>
          <p>Sign in with an authorised admin email and its Supabase password to manage dates and view guest bookings.</p>
          <form onSubmit={signIn}>
            <label className="field"><span>Admin email</span><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label className="field"><span>Password</span><input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <button className="button button-primary full-width" disabled={busy}>{busy ? "Signing in…" : "Sign in to dashboard"} <ArrowRight size={16} /></button>
          </form>
          <div className="secure-note"><ShieldCheck size={14} /> Only the two authorised admin accounts can sign in.</div>
          {!supabase && <p className="setup-note">Connect a Supabase project to enable secure admin access.</p>}
        </div> : <div className="admin-dashboard">
          <div className="admin-title-row"><div><span className="eyebrow">Welcome back</span><h2 id="admin-title">Stay dashboard</h2></div><button className="signout-button" onClick={signOut}>Sign out</button></div>
          <p className="admin-email"><ShieldCheck size={14} /> Signed in as {session.user.email}</p>
          {error && <p className="admin-error" role="alert">{error}</p>}
          <section className="admin-card"><div className="admin-card-title"><CalendarDays size={18} /><div><strong>Block unavailable dates</strong><small>Prevent guest requests for these dates.</small></div></div>
            <form className="block-form" onSubmit={addBlockedDate}>
              <label className="field"><span>Accommodation</span><select value={property} onChange={(event) => setProperty(event.target.value)}><option value="clandstein">CLANDSTEIN Houseboat</option><option value="coates">Coates Cottage</option></select></label>
              <label className="field"><span>Date to block</span><input required type="date" min={dateOffset(0)} value={blockedOn} onChange={(event) => setBlockedOn(event.target.value)} /></label>
              <button className="button button-primary" type="submit"><Plus size={16} /> Block date</button>
            </form>
            <div className="admin-list">
              <h3>Blocked dates <span>{blockedDates.length}</span></h3>
              {loadingData ? <p className="empty-state">Loading dates…</p> : blockedDates.length === 0 ? <p className="empty-state">No dates blocked yet.</p> : blockedDates.map((date) => <div className="admin-list-row" key={`${date.property_id}-${date.blocked_on}`}><span><CalendarDays size={15} /> {prettyDate(date.blocked_on)}</span><small>{properties[date.property_id]?.name || date.property_id}</small><button className="unblock-button" aria-label={`Unblock ${prettyDate(date.blocked_on)}`} onClick={() => removeBlockedDate(date)}><X size={16} /></button></div>)}
            </div>
            <div className="admin-list">
              <h3>Blocked date ranges <span>{availabilityBlocks.length}</span></h3>
              <form className="block-form availability-block-form" onSubmit={addAvailabilityBlock}>
                <label className="field"><span>Accommodation</span><select value={property} onChange={(event) => setProperty(event.target.value)}><option value="clandstein">CLANDSTEIN Houseboat</option><option value="coates">Coates Cottage</option></select></label>
                <label className="field"><span>Block from</span><input required type="date" min={dateOffset(0)} value={blockedFrom} onChange={(event) => setBlockedFrom(event.target.value)} /></label>
                <label className="field"><span>Block through</span><input required type="date" min={blockedFrom} value={blockedTo} onChange={(event) => setBlockedTo(event.target.value)} /></label>
                <button className="button button-primary" type="submit"><Plus size={16} /> Block range</button>
              </form>
              {loadingData ? <p className="empty-state">Loading date ranges…</p> : availabilityBlocks.length === 0 ? <p className="empty-state">No date ranges blocked yet.</p> : availabilityBlocks.map((block) => (
                <div className="admin-list-row" key={block.id}>
                  <span><CalendarDays size={15} /> {prettyDate(block.check_in)} – {prettyDate(block.check_out)}</span>
                  <small>{properties[block.property_id]?.name || block.property_id}</small>
                  <button className="unblock-button" aria-label={`Unblock ${prettyDate(block.check_in)} through ${prettyDate(block.check_out)}`} onClick={() => removeAvailabilityBlock(block)}><X size={16} /></button>
                </div>
              ))}
            </div>
          </section>
          <section className="admin-card admin-bookings-card">
            <div className="admin-bookings-heading">
              <div className="admin-card-title"><MessageCircle size={18} /><div><strong>All bookings <span className="booking-count">{bookings.length}</span></strong><small>Guest details and requested stay dates.</small></div></div>
              <button className="refresh-bookings" disabled={loadingData} onClick={() => setDataRefresh((count) => count + 1)}><RefreshCw size={14} className={loadingData ? "is-spinning" : ""} /> {loadingData ? "Refreshing…" : "Refresh"}</button>
            </div>
            {loadingData ? <p className="empty-state">Loading all bookings…</p> : bookingsError ? <p className="admin-error bookings-load-error" role="alert">{bookingsError}</p> : bookings.length === 0 ? <p className="empty-state">No bookings have been saved yet.</p> : (
              <div className="bookings-table-wrap">
                <table className="bookings-table">
                  <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Stay</th><th>Dates</th><th>Guests</th></tr></thead>
                  <tbody>{bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td data-label="Name"><strong>{booking.name || "—"}</strong></td>
                      <td data-label="Email">{booking.email ? <a href={`mailto:${encodeURIComponent(booking.email)}?subject=${encodeURIComponent("Your Stay at UniLeisure enquiry")}`}>{booking.email}</a> : "—"}</td>
                      <td data-label="Phone">{booking.phone ? <a href={`tel:${encodeURIComponent(booking.phone)}`}>{booking.phone}</a> : "—"}</td>
                      <td data-label="Stay">{booking.houseboat_name||  "—"}</td>
                      <td data-label="Dates"><span className="booking-date-range">{prettyDate(booking.check_in)}<br /><span>to</span><br />{prettyDate(booking.check_out)}</span></td>
                      <td data-label="Guests">{booking.guests ?? "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        </div>}
        {error && !session && <p className="admin-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdminRoute = window.location.pathname === "/admin" || window.location.pathname === ADMIN_PATH;

  useEffect(() => {
    if (!isAdminRoute) return undefined;
    const previousTitle = document.title;
    let robots = document.querySelector('meta[name="robots"]');
    const previousRobots = robots?.getAttribute("content");
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.append(robots);
    }
    document.title = "Private admin | Stay at UniLeisure";
    robots.content = "noindex, nofollow";
    return () => {
      document.title = previousTitle;
      if (previousRobots === null || previousRobots === undefined) robots.remove();
      else robots.content = previousRobots;
    };
  }, [isAdminRoute]);

  useEffect(() => {
    function selectStay() {
      document.querySelector("#booking")?.scrollIntoView({ behavior: "smooth" });
    }
    window.addEventListener("select-stay", selectStay);
    return () => window.removeEventListener("select-stay", selectStay);
  }, []);

  if (isAdminRoute) {
    return <AdminPanel />;
  }

  return (
    <>
      <header className="site-header">
        <div className="nav-inner"><Brand />
          <button className="mobile-menu-button" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
          <nav className={menuOpen ? "nav-links is-open" : "nav-links"} aria-label="Main navigation" onClick={() => setMenuOpen(false)}>
            <a href="#kariba">Lake Kariba</a><a href="#nyanga">Nyanga</a><a href="#booking">Plan your stay</a>
            <a className="nav-contact" href={whatsappLink("Hello! I'd like to plan a stay with UniLeisure.")} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Talk to us</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <img className="hero-image" src="https://upload.wikimedia.org/wikipedia/commons/9/96/Central_nyanga_np.jpg" alt="View west from Mount Nyangani in Nyanga National Park, Zimbabwe" fetchPriority="high" />
          <div className="hero-shade" />
          <div className="hero-content">
            <span className="hero-kicker"><span /> TWO EXTRAORDINARY STAYS <i /> ZIMBABWE</span>
            <h1 className="hero-title"><span className="hero-brand-title">UniLeisure</span><span className="hero-tagline">A world away,<br /><em>closer than you think.</em></span></h1>
            <p>Find your stillness on Lake Kariba or breathe in the wild beauty of Nyanga. Two extraordinary escapes, thoughtfully hosted.</p>
            <div className="hero-actions"><a className="button button-white" href="#booking">Find your stay <ArrowRight size={17} /></a><a className="hero-secondary" href="#kariba">Discover the stays <ArrowDown size={15} /></a></div>
          </div>
          <div className="hero-orbit" aria-hidden="true"><span>YOUR ZIMBABWE ESCAPE</span><i /><MapPin size={19} /></div>
          <aside className="hero-stays" aria-label="Explore our two stays">
            <div className="hero-stays-heading"><span>ONE COUNTRY. TWO WORLDS.</span><strong>Choose your escape.</strong></div>
            <a className="hero-stay-card" href="#kariba">
              <img src="/images/clandstein-houseboat.jpg" alt="" />
              <span><small>LAKE KARIBA</small><strong>Life on the water</strong></span>
              <ArrowUpRight size={17} />
            </a>
            <a className="hero-stay-card" href="#nyanga">
              <img src="/images/coates-cottage.jpg" alt="" />
              <span><small>CONNEMARA · NYANGA</small><strong>A mountain hideaway</strong></span>
              <ArrowUpRight size={17} />
            </a>
            <div className="hero-stays-foot"><MapPin size={13} /> FROM THE HIGHLANDS TO THE LAKE</div>
          </aside>
          <div className="hero-bottom"><span><MapPin size={15} /> NYANGA & LAKE KARIBA, ZIMBABWE</span><span>THOUGHTFULLY HOSTED. BEAUTIFULLY UNHURRIED.</span></div>
          <div className="hero-side-note">A LITTLE CLOSER TO WHAT MATTERS</div>
        </section>

        <div className="trust-strip"><span><ShieldCheck size={17} /> Thoughtful stays, warm Zimbabwean hospitality</span><span><Waves size={17} /> Two one-of-a-kind escapes</span><span><MessageCircle size={17} /> Personal booking support on WhatsApp</span></div>

        <div className="intro"><span className="eyebrow">Two places. One feeling.</span><h2>Make room for <em>the good stuff.</em></h2><p>Unplug, gather your favourite people and settle into somewhere that feels a world away.</p></div>

        <KaribaSection />
        <BoatGallery />
        <div className="section-divider"><span>01</span><i /><span>02</span></div>
        <CottageSection />
        <BookingSection />
        <section className="closing-cta"><div><span className="eyebrow">Your Zimbabwe escape is waiting</span><h2>Somewhere wonderful<br />is closer than you think.</h2></div><a className="button button-white" href={whatsappLink("Hello! I'd love to plan a stay at UniLeisure.")} target="_blank" rel="noreferrer">Let’s plan it together <ArrowUpRight size={17} /></a></section>
      </main>

      <footer className="site-footer"><div className="footer-top"><div><Brand light /><p>Find your own kind of away.<br />Made with care in Zimbabwe.</p></div><div className="footer-links"><span className="eyebrow">Explore</span><a href="#kariba">CLANDSTEIN Houseboat</a><a href="#nyanga">Coates Cottage</a><a href="#booking">Plan your stay</a></div><div className="footer-links"><span className="eyebrow">Say hello</span><a href={whatsappLink("Hello Stay at UniLeisure!")} target="_blank" rel="noreferrer">WhatsApp +263 77 213 6751</a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Stay at UniLeisure</span><span>NYANGA · LAKE KARIBA · ZIMBABWE</span></div></footer>

      <Concierge />
    </>
  );
}

export default App;
