import { Mail, MapPin, Phone, Clock3, ArrowUpRight, User, Globe } from "lucide-react";
import { publicData } from "@/server/public-data";
import { Button, Badge } from "@/components/ui";

export const metadata = { title: "Get in touch" };

export default async function Contact() {
  const { catalogue: c, demo } = await publicData();

  const studioEmail =
    c.site.email && c.site.email !== "studio@example.com"
      ? c.site.email
      : "balajistudio@doorstepdetailer.in";

  const studioPhone = c.site.phone || "+91 91230 66336";

  return (
    <main id="main" className="section-wrap">
      <div className="section-kicker">A GOOD CONVERSATION STARTS HERE</div>
      <div className="page-heading">
        <h1>
          LET’S TALK
          <br />
          ABOUT YOUR DRIVE.
        </h1>
        <p>
          Not sure where to start?
          <br />
          We’re here to help you choose.
        </p>
      </div>
      <div className="contact-grid">
        <div>
          <div className="contact-line">
            <MapPin size={21} />
            <span>
              <small>VISIT THE STUDIO</small>
              <strong>Balaji Studio</strong>
              <br />
              Kumra Kashipur, Plot 92.1, Gourbanga Rd, Habra-I, 743271, WB, IN
            </span>
          </div>
          <div className="contact-line">
            <Mail size={21} />
            <span>
              <small>DROP US A LINE</small>
              <a href={`mailto:${studioEmail}`}>{studioEmail}</a>
            </span>
          </div>
          <div className="contact-line">
            <Phone size={21} />
            <span>
              <small>CALL THE STUDIO</small>
              <a href={`tel:${studioPhone.replace(/[^+\d]/g, "")}`}>
                {studioPhone}
              </a>
            </span>
          </div>
          <div className="contact-line">
            <User size={21} />
            <span>
              <small>SHOP OWNER</small>
              Bikrant Mallick
            </span>
          </div>
          <div className="contact-line">
            <Globe size={21} />
            <span>
              <small>WEBSITE OWNER & DEVELOPER</small>
              <a
                href="https://github.com/knightryder098"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                Gobinda Lugun <ArrowUpRight size={14} />
              </a>
            </span>
          </div>
          <div className="contact-line">
            <Clock3 size={21} />
            <span>
              <small>STUDIO HOURS / IST</small>
              {String(c.schedule.opens).padStart(2, "0")}:00 –{" "}
              {String(c.schedule.closes).padStart(2, "0")}:00
              <br />
              <small>
                {c.schedule.closedWeekdays.length
                  ? `Closed ${c.schedule.closedWeekdays
                      .map(
                        (d) =>
                          [
                            "Sunday",
                            "Monday",
                            "Tuesday",
                            "Wednesday",
                            "Thursday",
                            "Friday",
                            "Saturday",
                          ][d]
                      )
                      .join(", ")}`
                  : "Open every day"}
              </small>
            </span>
          </div>
          {c.site.mapUrl && (
            <a
              href={c.site.mapUrl}
              className="arrow-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get directions <ArrowUpRight size={17} />
            </a>
          )}
        </div>
        <div className="contact-panel">
          <Badge>FOR THE CAR YOU LOVE</Badge>
          <h2 style={{ marginTop: 22 }}>
            A LITTLE GUIDANCE.
            <br />
            THE RIGHT CARE.
          </h2>
          <p>
            If your car model is not listed, or you need help deciding between
            treatments, speak to the studio before booking. A reviewed quote
            takes your car and its condition into account.
          </p>
          <Button href="/booking">
            Explore booking options <ArrowUpRight size={16} />
          </Button>
          {demo && (
            <p className="detail-note" style={{ textAlign: "left" }}>
              This is a local demonstration. Contact details must be approved
              before live publication.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
