import { SalCard } from "@repo/design-system/components/sal/card";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * v5 Screens (brand/BRAND-BOOK.md, "Screens"): square corners, the 2px
 * frame, one solid offset that falls toward the end of the line and
 * collapses when pressed, tracked capitals for labels only (never Arabic).
 * Check each story on both grounds (Theme toolbar) and in both directions.
 */
const meta = {
  title: "SAL/Screens (v5)",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Buttons: Story = {
  render: () => (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-4">
        <Button>Book a place</Button>
        <Button variant="outline">Add to calendar</Button>
        <Button variant="secondary">Save draft</Button>
        <Button variant="ghost">Give my place back</Button>
        <Button variant="link">Read the Constitution</Button>
        <Button disabled>Sending…</Button>
      </div>
      <div className="flex flex-wrap gap-4" dir="rtl" lang="ar">
        <Button>احجز مكانًا</Button>
        <Button variant="outline">أضف إلى التقويم</Button>
      </div>
    </div>
  ),
};

export const Cards: Story = {
  render: () => (
    <div className="grid max-w-4xl gap-6 md:grid-cols-2">
      <article className="frame grid gap-2 bg-surface p-card-padding shadow-offset">
        <p className="type-kicker">Tuesday, October 13 · 6:00 PM</p>
        <h3 className="type-heading">Open Pages</h3>
        <p className="type-body text-text-secondary">
          Read a page you love, or just listen.
        </p>
        <p className="type-caption">24 places left</p>
      </article>
      <SalCard className="shadow-offset">
        <p className="type-kicker">Members</p>
        <p className="font-bold text-4xl text-title tabular-nums">128</p>
        <p className="type-body">
          41 are Voting Members (two activities this semester or last).
        </p>
      </SalCard>
      <article
        className="frame grid gap-2 bg-surface p-card-padding shadow-offset-accent"
        dir="rtl"
        lang="ar"
      >
        <p className="type-kicker">الثلاثاء، 13 تشرين الأول</p>
        <h3 className="type-heading">صفحات مفتوحة</h3>
        <p className="type-body">اقرأ صفحة تحبها، أو استمع فحسب.</p>
      </article>
    </div>
  ),
};

export const Form: Story = {
  render: () => (
    <form className="grid max-w-md gap-4">
      <div className="grid gap-2">
        <Label htmlFor="story-email">Email</Label>
        <Input id="story-email" placeholder="name@auib.edu.iq" type="email" />
        <p className="type-caption">
          Use your AUIB address (@auib.edu.iq) if you have one.
        </p>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox id="story-pledge" />
        <Label className="leading-normal" htmlFor="story-pledge">
          I make the Member Pledge
        </Label>
      </div>
      <Button className="justify-self-start" type="submit">
        Send the link
      </Button>
    </form>
  ),
};

export const LabelsNeverTrackArabic: Story = {
  render: () => (
    <div className="grid gap-4">
      <p className="type-kicker">Coming up</p>
      <p className="type-kicker" lang="ar">
        قريبًا
      </p>
      <p className="type-label text-xs">Navigation label</p>
      <p className="type-label text-xs" lang="ar">
        الفعاليات
      </p>
    </div>
  ),
};
