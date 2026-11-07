/** /drively/d/:id loads the file and hands it to the right editor. Editors are lazy: each has heavy libraries. */
import React, { Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { clearClientSession, isClientPortalPath } from '../../services/clientPortal.service';
import { DriveDetail, drivelyService } from '../../services/drively.service';
import { hubErrorMessage, hubErrorStatus } from '../../services/hub.service';
import EmptyState from '../hub/ui/EmptyState';
import { Skeleton } from '../hub/ui/Skeleton';

const DocsEditor = React.lazy(() => import('./DocsEditor'));
const GridEditor = React.lazy(() => import('./GridEditor'));
const SlidesEditor = React.lazy(() => import('./SlidesEditor'));
const PdfEditor = React.lazy(() => import('./PdfEditor'));
const FilePreview = React.lazy(() => import('./FilePreview'));

const Loading = () => <div className="drv-loading"><Skeleton height={44} /><Skeleton height={420} /></div>;

const DriveOpen: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const portal = isClientPortalPath();
  const [item, setItem] = useState<DriveDetail | null>(null);
  const [error, setError] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    setItem(null);
    setError(null);
    drivelyService
      .get(id)
      .then(setItem)
      .catch((err) => {
        if (portal && hubErrorStatus(err) === 401) {
          clearClientSession();
          navigate('/client', { replace: true });
          return;
        }
        setError(
          hubErrorStatus(err) === 404
            ? { title: "This file isn't available", body: "It may have been deleted, or you don't have access. Ask its owner to share it with you." }
            : { title: "Couldn't open this file", body: hubErrorMessage(err) },
        );
      });
  }, [id, navigate, portal]);

  if (error) {
    return (
      <div className="drv-loading">
        <EmptyState icon="alert" title={error.title} text={error.body}>
          <Link className="hub-btn" to={portal ? '/client/files' : '/drively'}>{portal ? 'Back to your files' : 'Back to Drively'}</Link>
        </EmptyState>
      </div>
    );
  }
  if (!item) return <Loading />;
  return (
    <Suspense fallback={<Loading />}>
      {item.kind === 'doc' && <DocsEditor key={item.id} item={item} />}
      {item.kind === 'grid' && <GridEditor key={item.id} item={item} />}
      {item.kind === 'slides' && <SlidesEditor key={item.id} item={item} />}
      {item.kind === 'pdf' && <PdfEditor key={item.id} item={item} />}
      {item.kind === 'file' && <FilePreview key={item.id} item={item} />}
    </Suspense>
  );
};

export default DriveOpen;
