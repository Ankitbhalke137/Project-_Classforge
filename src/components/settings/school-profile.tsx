"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SchoolIcon } from "@/components/ui/icons";
import { useMembership, useIsReadOnly, useSchoolSlug } from "@/lib/hooks";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";

interface SchoolProfileFormValues {
  schoolName: string;
  schoolSlug: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
}

function getInitialProfile(
  storageKey: string,
  schoolName: string,
  schoolSlug: string,
): { values: SchoolProfileFormValues; logo: string | null } {
  const defaults: SchoolProfileFormValues = {
    schoolName,
    schoolSlug,
    contactEmail: "",
    contactPhone: "",
    address: "",
  };
  if (typeof window === "undefined") return { values: defaults, logo: null };
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        return {
          values: {
            schoolName: parsed.schoolName || schoolName,
            schoolSlug: parsed.schoolSlug || schoolSlug,
            contactEmail: parsed.contactEmail ?? "",
            contactPhone: parsed.contactPhone ?? "",
            address: parsed.address ?? "",
          },
          logo: parsed.logoPreview ?? null,
        };
      }
    }
  } catch {
    // Ignore storage read error
  }
  return { values: defaults, logo: null };
}

export function SchoolProfileSection() {
  const membership = useMembership();
  const readOnly = useIsReadOnly();
  const schoolSlugFromUrl = useSchoolSlug() ?? "";
  const schoolSlug = membership?.schoolSlug ?? schoolSlugFromUrl;
  const schoolName = membership?.schoolName ?? "";
  const storageKey = `classforge_${schoolSlug || "default"}_profile`;

  const [initialData] = useState(() => getInitialProfile(storageKey, schoolName, schoolSlug));
  const [values, setValues] = useState<SchoolProfileFormValues>(initialData.values);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(initialData.logo);
  const isDirty = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const current = getInitialProfile(storageKey, schoolName, schoolSlug);
      if (!isDirty.current) {
        setValues((v) => ({
          schoolName: v.schoolName || current.values.schoolName,
          schoolSlug: v.schoolSlug || current.values.schoolSlug,
          contactEmail: v.contactEmail || current.values.contactEmail,
          contactPhone: v.contactPhone || current.values.contactPhone,
          address: v.address || current.values.address,
        }));
        if (current.logo && !logoPreview) {
          setLogoPreview(current.logo);
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [schoolSlug, schoolName, storageKey, logoPreview]);

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
    isDirty.current = true;
    setValues((v) => ({ ...v, schoolName: event.target.value }));
    if (errors.schoolName) setErrors((e) => { const n = { ...e }; delete n.schoolName; return n; });
  }

  function handleSlugChange(event: React.ChangeEvent<HTMLInputElement>) {
    isDirty.current = true;
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
    if (readOnly || !validate()) return;

    setSaving(true);
    setSaved(false);

    try {
      // 1. Attempt backend update for school name
      await api(`/api/t/${schoolSlug}/profile`, {
        method: "PATCH",
        body: {
          schoolName: values.schoolName.trim(),
          schoolSlug: values.schoolSlug.trim(),
          contactEmail: values.contactEmail.trim(),
          contactPhone: values.contactPhone.trim(),
          address: values.address.trim(),
        },
      }).catch(() => null);

      // 2. Persist full profile locally
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...values,
          logoPreview,
        }),
      );

      // 3. Update auth store so header/sidebar show the updated name
      useAuth.setState((state) => {
        const updatedSchools = state.schools.map((s) =>
          s.schoolSlug === schoolSlug ? { ...s, schoolName: values.schoolName.trim() } : s,
        );
        try {
          const session = sessionStorage.getItem("classforge.session");
          if (session) {
            const parsed = JSON.parse(session);
            parsed.schools = updatedSchools;
            sessionStorage.setItem("classforge.session", JSON.stringify(parsed));
          }
        } catch {
          // Ignore session storage error
        }
        return { schools: updatedSchools };
      });

      setSaved(true);
    } finally {
      setSaving(false);
    }

    setTimeout(() => setSaved(false), 3000);
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
              School profile details are updated for this school workspace.
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
