import { BrandLogo } from "@repo/design-system/components/brand-logo";
import { SalCard } from "@repo/design-system/components/sal/card";
import { DocumentFooter } from "@repo/design-system/components/sal/document-footer";
import { DocumentHeader } from "@repo/design-system/components/sal/document-header";
import { FormHeader } from "@repo/design-system/components/sal/form-header";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * SAL brand components. INTERIM layouts until brand/components (the HTML
 * sources of Document Cover, Document Footer and Form Header) is supplied.
 * Check each story in both directions with the Direction toolbar.
 */
const meta = {
  title: "SAL/Brand",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const TypeStyles: Story = {
  render: () => (
    <div className="grid max-w-2xl gap-4">
      <p className="type-kicker">Kicker</p>
      <h1 className="type-display">Display: The paper and the pen</h1>
      <p className="type-lede">
        Lede: a bilingual student society for literature, theatre and the arts.
      </p>
      <h2 className="type-heading">Heading</h2>
      <p className="type-body">Body text sits on the surface in ink.</p>
      <p className="type-caption">
        Caption in ink-50, for captions on white only.
      </p>
      <p className="type-code">SAL-GOV-01 · Article 7</p>
      <p className="type-body" lang="ar">
        والقرطاسُ والقلم
      </p>
    </div>
  ),
};

export const Form: Story = {
  render: () => (
    <FormHeader kicker="Membership" title="Before you begin">
      Two pledges and a few choices.
    </FormHeader>
  ),
};

export const Document: Story = {
  render: () => (
    <article className="grid max-w-3xl gap-6">
      <DocumentHeader
        code="SAL-GOV-01"
        titleAr="الدستور"
        titleEn="Constitution"
        version="1"
      />
      <p className="type-body">TODO(content): document text.</p>
      <DocumentFooter code="SAL-GOV-01" motto="والقرطاسُ والقلم" />
    </article>
  ),
};

export const Card: Story = {
  render: () => (
    <SalCard className="max-w-sm">
      <p className="type-kicker">Membership card</p>
      <h2 className="type-heading">Member name</h2>
      <p className="type-body">
        Cards sit on surface-tint with the 8px card radius and no shadow.
      </p>
    </SalCard>
  ),
};

export const Logo: Story = {
  render: () => <BrandLogo />,
};

export const Band: Story = {
  render: () => (
    <section className="band p-8">
      <h2 className="font-bold text-2xl">Join the Society</h2>
      <p>At most one full-bleed band per page.</p>
    </section>
  ),
};
