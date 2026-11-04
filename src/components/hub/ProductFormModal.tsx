/**
 * ProductFormModal — Add product (no `product`) or Edit product (with `product`).
 *   <ProductFormModal onClose={…} onSaved={(p) => …} />
 *   <ProductFormModal product={detail} onClose={…} onSaved={(p) => …} />
 * onSaved receives the product returned by the API (its slug may have changed on rename).
 */
import React from 'react';
import { hubService, Product, ProductDetail, ProductStatus } from '../../services/hub.service';
import { FieldRow, FormModal, SelectField, TextField, useForm, UserField } from './ui/FormModal';
import { currentHubUser } from './ui/users';
import { isValidUrl, PRODUCT_STATUS_OPTIONS } from './hubUtils';

interface Values {
  name: string;
  code: string;
  description: string;
  status: ProductStatus;
  version: string;
  ownerId: string;
  productionUrl: string;
}

export interface ProductFormModalProps {
  product?: ProductDetail | null;
  onClose: () => void;
  onSaved: (product: Product) => void;
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({ product, onClose, onSaved }) => {
  const editing = !!product;
  const form = useForm<Values>({
    name: product?.name || '',
    code: '',
    description: product?.description || '',
    status: product?.status || 'building',
    version: product?.version || '',
    ownerId: product?.ownerId || currentHubUser()?.id || '',
    productionUrl: '',
  });

  return (
    <FormModal
      form={form}
      title={editing ? 'Edit product' : 'Add product'}
      description={editing ? undefined : 'Everyone signed in can see and edit it.'}
      submitLabel={editing ? 'Save changes' : 'Add product'}
      failMessage={editing ? "Couldn't save your changes." : "Couldn't add the product."}
      validate={(v) => ({
        name: !v.name.trim() ? 'Enter the product name.' : v.name.trim().length > 80 ? 'Keep the name under 80 characters.' : undefined,
        code:
          v.code.trim() && !/^[A-Za-z0-9]{2,5}$/.test(v.code.trim())
            ? 'Use 2 to 5 letters or numbers, like CF.'
            : undefined,
        ownerId: !v.ownerId ? 'Choose who owns this product.' : undefined,
        productionUrl:
          v.productionUrl.trim() && !isValidUrl(v.productionUrl) ? 'Enter a full web address that starts with https://' : undefined,
      })}
      mapServerError={(msg) =>
        /already exists|name/i.test(msg) && /product/i.test(msg)
          ? { name: msg }
          : !editing && /code|prefix/i.test(msg)
            ? { code: msg }
            : null
      }
      onSubmit={async (v) => {
        if (product) {
          const saved = await hubService.updateProduct(product.id, {
            name: v.name.trim(),
            description: v.description.trim() || null,
            status: v.status,
            version: v.version.trim() || null,
            ownerId: v.ownerId,
          });
          onSaved(saved || { ...product, name: v.name.trim() });
          return 'Changes saved';
        }
        const created = await hubService.createProduct({
          name: v.name.trim(),
          code: v.code.trim() ? v.code.trim().toUpperCase() : undefined,
          description: v.description.trim() || undefined,
          status: v.status,
          version: v.version.trim() || undefined,
          ownerId: v.ownerId,
          productionUrl: v.productionUrl.trim() || undefined,
        });
        onSaved(created);
        return `${created?.name || v.name.trim()} added`;
      }}
      onClose={onClose}
    >
      <TextField form={form} name="name" label="Product name" required placeholder="e.g. CourseForge" />
      {!editing && (
        <TextField
          form={form}
          name="code"
          label="Ticket prefix"
          width="sm"
          mono
          maxLength={5}
          placeholder="CF"
          hint="Used for ticket numbers like CF-12. Leave empty to create one from the name."
        />
      )}
      <TextField form={form} name="description" label="One-line description" width="full" placeholder="What it does, in one sentence" />
      <FieldRow>
        <SelectField form={form} name="status" label="Status" options={PRODUCT_STATUS_OPTIONS} required />
        <TextField form={form} name="version" label="Current version" width="sm" placeholder="v1.0" />
      </FieldRow>
      <UserField form={form} name="ownerId" label="Owner" required hint="The person who answers questions about this product." />
      {!editing && (
        <TextField
          form={form}
          name="productionUrl"
          label="Production URL"
          type="url"
          inputMode="url"
          width="full"
          placeholder="https://"
          hint="Added to Files & links as the Production environment."
        />
      )}
    </FormModal>
  );
};

export default ProductFormModal;
