/** Any other upload: shows it if the browser can, offers Download, and turns Office files into editable ones. */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DriveDetail, drivelyService, fetchDriveBytes, saveBlob } from '../../services/drively.service';
import { hubErrorMessage } from '../../services/hub.service';
import EmptyState from '../hub/ui/EmptyState';
import Icon from '../hub/ui/Icon';
import { Skeleton } from '../hub/ui/Skeleton';
import { useToast } from '../hub/ui/Toast';
import { blankTab, formatBytes, itemHref, OfficeTarget, officeTarget, sendTab } from './driveContent';
import EditorShell from './EditorShell';

const TARGET_LABEL: Record<OfficeTarget, string> = { doc: 'Docs', grid: 'Grid', slides: 'Slides' };
const MAX_TEXT_BYTES = 2 * 1024 * 1024;

const FilePreview: React.FC<{ item: DriveDetail }> = ({ item }) => {
  const toast = useToast();
  const navigate = useNavigate();
  const [link, setLink] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const type = item.contentType || '';
  const target = officeTarget(item);
  const showsText = (type.startsWith('text/') || type === 'application/json') && item.sizeBytes <= MAX_TEXT_BYTES;

  useEffect(() => {
    drivelyService
      .link(item.id)
      .then(async ({ url }) => {
        setLink(url);
        if (showsText) setText(await (await fetch(url)).text());
      })
      .catch((err) => setError(hubErrorMessage(err, "Couldn't open this file.")));
  }, [item.id, showsText]);

  const download = async () => {
    try {
      saveBlob(new Blob([await fetchDriveBytes(item.id)], { type }), item.name);
    } catch {
      toast.error("Couldn't download the file.");
    }
  };

  const convert = async () => {
    if (!target) return;
    setConverting(true);
    const tab = blankTab();
    try {
      const bytes = await fetchDriveBytes(item.id);
      const imp = await import('./driveImport');
      const made =
        target === 'doc'
          ? await imp.createDocFromBytes(bytes, item.name, item.parentId)
          : target === 'grid'
            ? await imp.createGridFromBytes(bytes, item.name, item.parentId)
            : await imp.createSlidesFromBytes(bytes, item.name, item.parentId);
      toast.show(`Created “${made.name}”. The original stays as it was.`);
      sendTab(tab, itemHref(made), navigate);
      setConverting(false);
    } catch (err) {
      tab?.close();
      toast.error(hubErrorMessage(err, `Couldn't open this in ${TARGET_LABEL[target]}. The file may be damaged.`));
      setConverting(false);
    }
  };

  const actions = (
    <>
      {target && item.myAccess !== 'view' && (
        <button type="button" className="hub-btn hub-btn-primary" disabled={converting} onClick={convert}>{converting ? 'Converting…' : `Edit in ${TARGET_LABEL[target]}`}</button>
      )}
      <button type="button" className="hub-btn" onClick={download}><Icon name="download" size={15} /> Download</button>
    </>
  );

  let body: React.ReactNode;
  if (error) body = <EmptyState icon="alert" title="Can't show this file" text={error} />;
  else if (!link) body = <div className="drv-loading"><Skeleton height={400} /></div>;
  else if (type.startsWith('image/') && type !== 'image/svg+xml') body = <img className="drv-preview-media" src={link} alt={item.name} />;
  else if (type.startsWith('video/')) body = <video className="drv-preview-media" src={link} controls />;
  else if (type.startsWith('audio/')) body = <audio src={link} controls />;
  else if (showsText) body = text === null ? <Skeleton height={300} /> : <pre className="drv-preview-text">{text}</pre>;
  else {
    body = (
      <EmptyState icon="file" title={item.name} text={target ? `${formatBytes(item.sizeBytes)}. Edit it in ${TARGET_LABEL[target]} to make an editable copy, or download it.` : `${formatBytes(item.sizeBytes)}. There's no preview for this type of file, so download it to open it.`} />
    );
  }

  return (
    <EditorShell item={item} actions={actions}>
      <div className="drv-preview">{body}</div>
    </EditorShell>
  );
};

export default FilePreview;
