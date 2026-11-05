/** Schedule a new meeting, or edit one when `meeting` is given. */
import React, { useEffect, useState } from 'react';
import { authService } from '../../services/auth.service';
import { Meeting, meetingsService } from '../../services/meetings.service';
import { projectService } from '../../services/project.service';
import { Field, FormModal, SelectField, TextAreaField, TextField, useForm } from '../hub/ui/FormModal';
import { nextStart, toLocalInput } from './meetingUtils';
import PeoplePicker from './PeoplePicker';

const LENGTHS = [15, 30, 45, 60, 90, 120].map((m) => ({ value: String(m), label: m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? '' : 's'}` }));

type MeetingForm = {
  title: string;
  startsAt: string;
  durationMinutes: string;
  projectId: string;
  notes: string;
  inviteeIds: string[];
};

const ScheduleMeetingModal: React.FC<{
  meeting?: Meeting;
  onClose: () => void;
  onSaved: (meeting: Meeting) => void;
}> = ({ meeting, onClose, onSaved }) => {
  const form = useForm<MeetingForm>({
    title: meeting?.title ?? '',
    startsAt: toLocalInput(meeting ? new Date(meeting.startsAt) : nextStart()),
    durationMinutes: String(meeting?.durationMinutes ?? 30),
    projectId: meeting?.project?.id ?? '',
    notes: meeting?.notes ?? '',
    inviteeIds: meeting?.invitees.map((i) => i.user.id) ?? [],
  });
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([]);
  const hostId: string | undefined = meeting?.host?.id ?? authService.getUser()?.id;

  useEffect(() => {
    let live = true;
    projectService
      .getAll()
      .then((list) => {
        if (!live) return;
        const options = list
          .map((p: any) => ({ value: p.id as string, label: (p.clientName || p.name || 'Untitled') as string }))
          .sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label));
        setProjects(options);
      })
      // The project is optional, so a failed list only leaves the menu empty.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const lengths = LENGTHS.some((l) => l.value === form.values.durationMinutes)
    ? LENGTHS
    : [{ value: form.values.durationMinutes, label: `${form.values.durationMinutes} minutes` }, ...LENGTHS];
  const projectOptions =
    meeting?.project && !projects.some((p) => p.value === meeting.project?.id)
      ? [{ value: meeting.project.id, label: meeting.project.name }, ...projects]
      : projects;

  return (
    <FormModal
      form={form}
      title={meeting ? 'Edit meeting' : 'Schedule a meeting'}
      size="md"
      submitLabel={meeting ? 'Save changes' : 'Schedule meeting'}
      busyLabel="Saving…"
      failMessage="Couldn't save the meeting."
      validate={(v) => ({
        title: v.title.trim() ? undefined : 'Give the meeting a title.',
        startsAt: !v.startsAt || isNaN(new Date(v.startsAt).getTime()) ? 'Choose a start time.' : undefined,
      })}
      onSubmit={async (v) => {
        const input = {
          title: v.title.trim(),
          startsAt: new Date(v.startsAt).toISOString(),
          durationMinutes: Number(v.durationMinutes),
          projectId: v.projectId || null,
          notes: v.notes.trim() || null,
          inviteeIds: v.inviteeIds,
        };
        onSaved(meeting ? await meetingsService.update(meeting.id, input) : await meetingsService.create(input));
        return meeting ? 'Meeting updated' : 'Meeting scheduled';
      }}
      onClose={onClose}
    >
      <TextField form={form} name="title" label="Title" required maxLength={200} width="full" placeholder="Website review with Amanda" />
      <div className="mt-form-row">
        <TextField form={form} name="startsAt" label="Starts" required type="datetime-local" width="full" />
        <SelectField form={form} name="durationMinutes" label="Length" required width="full" options={lengths} />
      </div>
      <SelectField form={form} name="projectId" label="Project" width="full" placeholder="No project" options={projectOptions} />
      <Field id={form.fieldId('inviteeIds')} label="Invite teammates" hint="They get a notification with a link to the meeting.">
        <PeoplePicker selected={form.values.inviteeIds} onChange={(ids) => form.set('inviteeIds', ids)} excludeIds={hostId ? [hostId] : []} />
      </Field>
      <TextAreaField form={form} name="notes" label="Notes" rows={3} placeholder="What this meeting is about" />
    </FormModal>
  );
};

export default ScheduleMeetingModal;
