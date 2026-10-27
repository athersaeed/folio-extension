// Synthetic stand-in for a Greenhouse job-boards application form. It mirrors the
// markup and quirks seen on the live site (2026-10): react-select dropdowns whose
// menu is controlled by the wrapper and opens on keyup/mouseup only, a hidden file
// input inside role="group", and question_<id> inputs. No real company content.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import Select, { components } from "react-select";

const state = {};
window.formState = state;

function Text({ id, label, required, type = "text", textarea }) {
  const [value, setValue] = useState("");
  state[id] = value;
  const Tag = textarea ? "textarea" : "input";
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true">*</span>}
      </label>
      <Tag
        id={id}
        type={type}
        value={value}
        aria-required={required ? "true" : undefined}
        onChange={(e) => setValue(e.currentTarget.value)}
      />
    </div>
  );
}

// Greenhouse's custom Control/Input components forward these wrapper handlers;
// plain react-select would ignore onKeyUp/onMouseUp props.
const Control = (props) => (
  <div onMouseUp={props.selectProps.onMouseUp}>
    <components.Control {...props} />
  </div>
);
const Input = (props) => (
  <components.Input {...props} onKeyUp={props.selectProps.onKeyUp} />
);
// Same control logic as Greenhouse's wrapper: menuIsOpen is local state.
function GhSelect({
  id,
  label,
  options,
  required,
  onInputChange,
  hideDropdownIndicator,
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(null);
  state[id] = value?.label ?? null;
  return (
    <div className="select__container">
      <label id={`${id}-label`} htmlFor={id} className="label select__label">
        {label}
        {required && <span aria-hidden="true">*</span>}
      </label>
      <Select
        inputId={id}
        instanceId={id}
        className="select-shell"
        classNamePrefix="select"
        aria-labelledby={`${id}-label`}
        required={required}
        options={options.map((o) => ({ label: o, value: o }))}
        onInputChange={onInputChange}
        filterOption={onInputChange ? () => true : undefined}
        value={value}
        onChange={(v) => {
          setValue(v);
          setOpen(false);
        }}
        components={{ Control, Input }}
        menuIsOpen={open}
        onKeyUp={(e) =>
          e.code === "Escape" || e.code === "Tab"
            ? setOpen(false)
            : e.code !== "Enter" && setOpen(true)
        }
        onBlur={() => setOpen(false)}
        onMouseUp={() => setOpen(!open)}
      />
    </div>
  );
}

// Greenhouse's candidate-location: options arrive from a search provider after
// typing (here a fake, delayed one).
const PLACES = [
  "Toronto, Ontario, Canada",
  "Toronto, Ohio, United States",
  "North Toronto, Ontario, Canada",
  "Waterloo, Ontario, Canada",
];
function GhLocation() {
  const [options, setOptions] = useState([]);
  return (
    <GhSelect
      id="candidate-location"
      label="Location (City)"
      required
      options={options}
      onInputChange={(text) => {
        const t = text.toLowerCase().split(",")[0].trim();
        setTimeout(
          () =>
            setOptions(
              t ? PLACES.filter((p) => p.toLowerCase().includes(t)) : [],
            ),
          250,
        );
      }}
    />
  );
}

function Upload() {
  const [name, setName] = useState("");
  state.resume = name;
  return (
    <div
      role="group"
      aria-labelledby="upload-label-resume"
      aria-required="true"
      className="file-upload"
    >
      <div id="upload-label-resume" className="label upload-label">
        Resume/CV<span className="required">*</span>
      </div>
      <button type="button">Attach</button>
      <label className="visually-hidden" htmlFor="resume">
        Attach
      </label>
      <input
        id="resume"
        className="visually-hidden"
        type="file"
        onChange={(e) => setName(e.currentTarget.files[0]?.name || "")}
      />
      <p>{name ? `Attached: ${name}` : "No file"}</p>
    </div>
  );
}

function Radio({ name, legend, options }) {
  const [value, setValue] = useState("");
  state[name] = value;
  return (
    <fieldset>
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={o}>
          <input
            type="radio"
            name={name}
            value={o}
            checked={value === o}
            onChange={() => setValue(o)}
          />{" "}
          {o}
        </label>
      ))}
    </fieldset>
  );
}

function NativeSelect({ id, label, options }) {
  const [value, setValue] = useState("");
  state[id] = value;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
      >
        <option value="">Please select</option>
        {options.map((o) => (
          <option key={o} value={o.toLowerCase().replace(/\W+/g, "_")}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

// Education and employment, as on job-boards.greenhouse.io: one block per entry
// with "--n" / "-n" ids, and an "Add another" button that appends a block.
// Schools come from a search (like Greenhouse's /education/schools?term=).
const SCHOOLS = [
  "Synthetic University",
  "Synthetic University - North Campus",
  "Example College",
];
const DEGREES = [
  "Associate's Degree",
  "Bachelor's Degree",
  "Doctor of Philosophy (Ph.D.)",
  "High School",
  "Master of Business Administration (M.B.A.)",
  "Master's Degree",
  "Other",
];
const DISCIPLINES = ["Biology", "Computer Science", "Mathematics", "Other"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
function School({ id }) {
  const [options, setOptions] = useState([]);
  return (
    <GhSelect
      id={id}
      label="School"
      options={options}
      onInputChange={(text) => {
        const t = text.toLowerCase().trim();
        setTimeout(
          () =>
            setOptions(
              t ? SCHOOLS.filter((s) => s.toLowerCase().includes(t)) : [],
            ),
          250,
        );
      }}
    />
  );
}
function Education() {
  const [count, setCount] = useState(1);
  return (
    <fieldset className="education">
      <legend>Education</legend>
      {Array.from({ length: count }, (_, n) => (
        <div key={n} className="education--entry">
          <School id={`school--${n}`} />
          <GhSelect id={`degree--${n}`} label="Degree" options={DEGREES} />
          <GhSelect
            id={`discipline--${n}`}
            label="Discipline"
            options={DISCIPLINES}
          />
          <GhSelect
            id={`start-month--${n}`}
            label="Start date month"
            options={MONTHS}
          />
          <Text id={`start-year--${n}`} label="Start date year" />
          <GhSelect
            id={`end-month--${n}`}
            label="End date month"
            options={MONTHS}
          />
          <Text id={`end-year--${n}`} label="End date year" />
        </div>
      ))}
      <button
        className="add-another-button"
        type="button"
        onClick={() => setCount(count + 1)}
      >
        Add another
      </button>
    </fieldset>
  );
}
function Job({ n }) {
  const [current, setCurrent] = useState(false);
  state[`current-role-${n}`] = current;
  return (
    <div className="employment--entry">
      <Text id={`company-name-${n}`} label="Company name" />
      <Text id={`title-${n}`} label="Title" />
      <GhSelect
        id={`start-date-month-${n}`}
        label="Start date month"
        options={MONTHS}
      />
      <Text id={`start-date-year-${n}`} label="Start date year" />
      {!current && (
        <>
          <GhSelect
            id={`end-date-month-${n}`}
            label="End date month"
            options={MONTHS}
          />
          <Text id={`end-date-year-${n}`} label="End date year" />
        </>
      )}
      <label htmlFor={`current-role-${n}_1`}>
        <input
          type="checkbox"
          id={`current-role-${n}_1`}
          name={`current-role-${n}`}
          checked={current}
          onChange={(e) => setCurrent(e.currentTarget.checked)}
        />
        Current role
      </label>
    </div>
  );
}
function Employment() {
  const [count, setCount] = useState(1);
  return (
    <fieldset className="employment">
      <legend>Employment</legend>
      {Array.from({ length: count }, (_, n) => (
        <Job key={n} n={n} />
      ))}
      <button
        className="add-another-button"
        type="button"
        onClick={() => setCount(count + 1)}
      >
        Add another
      </button>
    </fieldset>
  );
}

const YES_NO = ["Yes", "No"];
function App() {
  return (
    <form
      id="application-form"
      onSubmit={(e) => {
        e.preventDefault();
        window.submitted = true;
      }}
    >
      <h1>Apply for Synthetic Engineer</h1>
      <Text id="first_name" label="First Name" required />
      <Text id="last_name" label="Last Name" required />
      <Text id="email" label="Email" required />
      <GhSelect
        id="country"
        label="Country"
        options={["Canada", "United Kingdom", "United States"]}
      />
      <Text id="phone" label="Phone" type="tel" />
      <GhLocation />
      <Upload />
      <Employment />
      <Education />
      <Text id="question_1001" label="LinkedIn Profile" />
      <Text id="question_1002" label="Website" />
      <GhSelect
        id="question_1003"
        label="Are you legally authorized to work in the country in which this job is located?"
        options={YES_NO}
        required
      />
      <GhSelect
        id="question_1004"
        label="Will you now or in the future require sponsorship for employment visa status?"
        options={YES_NO}
        required
      />
      <GhSelect
        id="question_1005"
        label="Have you previously applied to this company?"
        options={YES_NO}
        required
      />
      <Text
        id="question_1006"
        label="Why do you want to work here?"
        required
        textarea
      />
      <Radio
        name="relocate"
        legend="Are you open to relocation?"
        options={YES_NO}
      />
      <NativeSelect
        id="hear"
        label="How did you hear about this job?"
        options={["LinkedIn", "Company website", "Referral", "Other"]}
      />
      <h2>Voluntary Self-Identification</h2>
      <GhSelect
        id="gender"
        label="Gender"
        options={["Male", "Female", "Decline To Self Identify"]}
      />
      <GhSelect
        id="hispanic_ethnicity"
        label="Are you Hispanic/Latino?"
        options={["Yes", "No", "Decline To Self Identify"]}
      />
      <GhSelect
        id="veteran_status"
        label="Veteran Status"
        options={[
          "I am not a protected veteran",
          "I identify as one or more of the classifications of protected veteran",
          "I don't wish to answer",
        ]}
      />
      <GhSelect
        id="disability_status"
        label="Disability Status"
        options={[
          "Yes, I have a disability (or previously had a disability)",
          "No, I do not have a disability and have not had one in the past",
          "I do not want to answer",
        ]}
      />
      <label>
        <input type="checkbox" id="consent" required /> I agree to the privacy
        policy
      </label>
      <button type="submit">Submit application</button>
    </form>
  );
}

createRoot(document.getElementById("root")).render(<App />);
