// Synthetic stand-in for an Ashby hosted application form (jobs.ashbyhq.com,
// 2026-10). It mirrors the live markup: field entries titled by a
// <label for> that often points at nothing, Yes/No questions as two
// aria-pressed buttons over a hidden checkbox, radio and checkbox groups in a
// fieldset with a <label> title (no legend), SMS consent radios inside the
// Phone entry, a native <select>, and an autocomplete whose listbox is
// rendered at the end of <body> and only opens after typing. No real company content.
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";

const state = {};
window.formState = state;

const Title = ({ htmlFor, children }) => (
  <label className="ashby-application-form-question-title" htmlFor={htmlFor}>
    {children}
  </label>
);

function Entry({ path, children }) {
  return (
    <div className="ashby-application-form-field-entry" data-field-path={path}>
      {children}
    </div>
  );
}

function Text({ path, title, type = "text", children }) {
  const [value, setValue] = useState("");
  state[path] = value;
  return (
    <Entry path={path}>
      <Title htmlFor={path}>{title}</Title>
      <input
        id={path}
        name={path}
        type={type}
        placeholder="Type here..."
        className="ashby-application-form-input-text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {children}
    </Entry>
  );
}

function YesNo({ path, title }) {
  const [value, setValue] = useState();
  state[path] = value ?? null;
  return (
    <Entry path={path}>
      <Title htmlFor={path}>{title}</Title>
      <div className="ashby-application-form-input-yesno">
        <button
          type="button"
          className="ashby-application-form-input-yesno-option"
          aria-pressed={value === true}
          onClick={() => setValue(value !== true || undefined)}
        >
          Yes
        </button>
        <button
          type="button"
          className="ashby-application-form-input-yesno-option"
          aria-pressed={value === false}
          onClick={() => setValue(value === false && undefined)}
        >
          No
        </button>
        <input
          type="checkbox"
          tabIndex={-1}
          name={path}
          style={{ display: "none" }}
          checked={value ?? false}
          onChange={(e) => setValue(e.target.checked)}
        />
      </div>
    </Entry>
  );
}

function Group({ path, title, options, multi }) {
  const [value, setValue] = useState(multi ? [] : null);
  state[path] = value;
  const kind = multi ? "checkbox" : "radio";
  return (
    <div data-field-path={path}>
      <fieldset className={`ashby-application-form-input-${kind}-group`}>
        <Title htmlFor={path}>{title}</Title>
        {options.map((o, i) => {
          const id = `form_${path}-labeled-${kind}-${i}`;
          const on = multi ? value.includes(o) : value === o;
          return (
            <div
              key={o}
              className={`ashby-application-form-input-${kind}-group-option`}
            >
              <input
                type={kind}
                id={id}
                name={multi ? o : `form_${path}`}
                checked={on}
                onChange={() =>
                  setValue(
                    multi
                      ? on
                        ? value.filter((v) => v !== o)
                        : [...value, o]
                      : o,
                  )
                }
              />
              <label htmlFor={id}>{o}</label>
            </div>
          );
        })}
      </fieldset>
    </div>
  );
}

function Dropdown({ path, title, options }) {
  const [value, setValue] = useState("");
  state[path] = value;
  return (
    <Entry path={path}>
      <Title htmlFor={path}>{title}</Title>
      <div className="ashby-application-form-input-dropdown">
        <select
          id={path}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          <option disabled hidden value="">
            Select...
          </option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    </Entry>
  );
}

const PLACES = [
  "Toronto, Ontario, Canada",
  "Toronto, Ohio, United States",
  "Springfield, Illinois, United States",
];
// Results arrive a moment after typing; the popup is portalled to <body>.
function Location({ path, title }) {
  const [text, setText] = useState("");
  const [picked, setPicked] = useState(null);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  state[path] = picked;
  const search = (q) => {
    setText(q);
    setOpen(true);
    setResults([]);
    const head = q.split(",")[0].trim().toLowerCase();
    setTimeout(
      () =>
        setResults(
          head ? PLACES.filter((p) => p.toLowerCase().startsWith(head)) : [],
        ),
      250,
    );
  };
  return (
    <Entry path={path}>
      <Title htmlFor={path}>{title}</Title>
      <div>
        <input
          className="ashby-application-form-input-autocomplete"
          placeholder="Start typing..."
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? "location-popup" : undefined}
          value={text}
          onChange={(e) => search(e.target.value)}
          onBlur={() => setText(picked ?? "")}
        />
      </div>
      {open &&
        createPortal(
          <div
            id="location-popup"
            role="listbox"
            className="ashby-application-form-input-autocomplete-popup"
          >
            {results.map((r) => (
              <div
                key={r}
                role="option"
                aria-selected="false"
                onClick={() => {
                  setPicked(r);
                  setText(r);
                  setOpen(false);
                }}
              >
                {r}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </Entry>
  );
}

function Form() {
  return (
    <div className="ashby-application-form-container">
      <div className="ashby-application-form-section-container">
        <Text path="_systemfield_name" title="Full Name" />
        <Text path="_systemfield_email" title="Email" type="email" />
        <Text path="phone-1" title="Phone" type="tel">
          <ul>
            <li>
              <p>SMS</p>
              <label>
                <input type="radio" name="smsConsent" value="given" />
                Yes - I consent to receiving SMS text messages
              </label>
              <label>
                <input type="radio" name="smsConsent" value="notGiven" />
                No - I do not consent to receiving SMS text messages
              </label>
            </li>
          </ul>
        </Text>
        <Location path="_systemfield_location" title="Location" />
        <Text path="linkedin-1" title="LinkedIn Profile" />
        <Group
          path="pronouns-1"
          title="What pronouns would you like our team to use when addressing you?"
          options={["He/Him", "She/Her", "They/Them", "Prefer not to say"]}
        />
        <YesNo
          path="sponsor-1"
          title="Will you now or in the future require us to sponsor an immigration case to employ you?"
        />
        <YesNo
          path="auth-1"
          title="Are you legally authorized to work in the United States?"
        />
        <YesNo
          path="react-1"
          title="Have you built production apps with React?"
        />
        <Dropdown
          path="heard-1"
          title="How did you hear about us?"
          options={["LinkedIn", "Friend", "Job board"]}
        />
        <Group
          path="channels-1"
          title="Which of these do you use? (select all that apply)"
          options={["Email", "Slack", "Teams"]}
          multi
        />
      </div>
      <div className="ashby-application-form-section-container">
        <Group
          path="_systemfield_eeoc_gender"
          title="Gender"
          options={["Male", "Female", "Decline to self-identify"]}
        />
        <Group
          path="_systemfield_eeoc_race"
          title="Race"
          options={[
            "Hispanic or Latino",
            "White (Not Hispanic or Latino)",
            "Asian (Not Hispanic or Latino)",
            "Decline to self-identify",
          ]}
        />
        <Group
          path="_systemfield_eeoc_veteran_status"
          title="Veteran Status"
          options={[
            "I am a veteran",
            "I am not a veteran",
            "Decline to self-identify",
          ]}
        />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Form />);
