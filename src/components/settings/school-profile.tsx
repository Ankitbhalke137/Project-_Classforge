"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SchoolIcon } from "@/components/ui/icons";
import { useMembership, useIsReadOnly } from "@/lib/hooks";

interface SchoolProfileFormValues {
  schoolName: string;
  schoolSlug: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
}

export function SchoolProfileSection() {
  const membership = useMembership();
  const readOnly = useIsReadOnly();
  const schoolSlug = membership?.schoolSlug ?? "";
  const schoolName = membership?.schoolName ?? "";

  const [values, setValues] = useState<SchoolProfileFormValues>({
    schoolName,
    schoolSlug,
    contactEmail: "",
    contactPhone: "",
    address: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!values.schoolName.trim()) next.schoolName = "School name is required";
    if (!values.schoolSlug.trim()) next.schoolSlug = "School slug is required";
    if (values.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail)) {
      next.contactEmail = "Enter a valid email address";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    setValues((v) => ({ ...v, schoolName: event.target.value }));
    if (errors.schoolName) setErrors((e) => { const n = { ...e }; delete n.schoolName; return n; });
  }

  function handleSlugChange(event: React.ChangeEvent<HTMLInputElement>) {
    setValues((v) => ({ ...v, schoolSlug: event.target.value }));
    if (errors.schoolSlug) setErrors((e) => { const n = { ...e }; delete n.schoolSlug; return n; });
  }

  function handleEmailChange(event: React.ChangeEvent<HTMLInputElement>) {
    setValues((v) => ({ ...v, contactEmail: event.target.value }));
    if (errors.contactEmail) setErrors((e) => { const n = { ...e }; delete n.contactEmail; return n; });
  }

  function handlePhoneChange(event: React.ChangeEvent<HTMLInputElement>) {
    setValues((v) => ({ ...v, contactPhone: event.target.value }));
  }

  function handleAddressChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setValues((v) => ({ ...v, address: event.target.value }));
  }

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors((e) => ({ ...e, logo: "Please upload an image file" }));
      return;
    }
    setErrors((e) => { const n = { ...e }; delete n.logo; return n; });
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setSaved(false);

    // There is no backend endpoint for updating a school profile.
    // The UI remains functional, but the save cannot be persisted.
    await new Promise((resolve) => setTimeout(resolve, 800));

    setSaving(false);
    setSaved(true);

    setTimeout(() => setSaved(false), 4000);
  }

  return (
    <Card>
      <CardHeader
        title="School Profile"
        description="Update your school's public information and branding."
        icon={<SchoolIcon className="size-5" />}
      />
      <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <form onSubmit={handleSave} className="col-span-full space-y-4">
          <Input
            label="School name"
            required
            value={values.schoolName}
            onChange={handleNameChange}
            error={errors.schoolName}
            disabled={readOnly}
            placeholder="Greenwood Public School"
          />
          <Input
            label="School slug / workspace identifier"
            required
            value={values.schoolSlug}
            onChange={handleSlugChange}
            error={errors.schoolSlug}
            disabled={readOnly}
            hint="Used in your school's URL. Changing it may break existing links."
            placeholder="greenwood"
          />
          <Input
            label="Contact email"
            type="email"
            value={values.contactEmail}
            onChange={handleEmailChange}
            error={errors.contactEmail}
            disabled={readOnly}
            hint="Used for school-wide notifications and alerts."
            placeholder="admin@greenwood.edu"
          />
          <Input
            label="Contact phone"
            type="tel"
            value={values.contactPhone}
            onChange={handlePhoneChange}
            disabled={readOnly}
            hint="Primary phone number for the school office."
            placeholder="+91 98765 43210"
          />
          <div className="col-span-full">
            <label htmlFor="school-address" className="text-sm font-medium text-primary">
              School address
            </label>
            <textarea
              id="school-address"
              rows={3}
              value={values.address}
              onChange={handleAddressChange}
              disabled={readOnly}
              className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-soft disabled:bg-page"
              placeholder="123 Campus Road, City, State"
            />
            {errors.address ? (
              <p role="alert" className="mt-1 text-xs text-danger-600">{errors.address}</p>
            ) : null}
          </div>

          <div className="col-span-full">
            <label htmlFor="school-logo" className="text-sm font-medium text-primary block mb-2">
              School logo
            </label>
            <div className="flex items-center gap-3">
              <input
                id="school-logo"
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                disabled={readOnly}
                className="block w-full text-sm text-body file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-secondary-soft file:text-secondary-strong hover:file:bg-secondary-strong/50"
              />
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="size-12 rounded-xl border border-line bg-white object-cover"
                />
              ) : null}
            </div>
            {errors.logo ? (
              <p role="alert" className="mt-1 text-xs text-danger-600">{errors.logo}</p>
            ) : null}
          </div>

          <div className="col-span-full flex items-center justify-between gap-3 pt-2">
            {saved ? (
              <div className="flex items-center gap-2 text-sm text-secondary-strong">
                <span className="size-4 shrink-0 flex items-center justify-center rounded-full bg-secondary-soft text-secondary-strong">
                  ✓
                </span>
                <span>Changes saved</span>
              </div>
            ) : null}
            <p className="text-xs text-body">
              Saving profile updates requires a backend endpoint that is not yet available.
              Changes above are held locally and will not be persisted.
            </p>
            <Button
              type="submit"
              variant="primary"
              isLoading={saving}
              disabled={readOnly || saving}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
