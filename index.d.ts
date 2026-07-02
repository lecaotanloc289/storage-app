/* eslint-disable no-unused-vars */

declare type FileType = "document" | "image" | "video" | "audio" | "other";

declare interface ActionType {
  label: string;
  icon: string;
  value: string;
}

declare interface SearchParamProps {
  params?: Promise<SegmentParams>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

declare interface UploadFileProps {
  file: File;
  ownerId: string;
  accountId: string;
  path: string;
}
declare interface GetFilesProps {
  types: FileType[];
  searchText?: string;
  sort?: string;
  limit?: number;
}
declare interface RenameFileProps {
  fileId: string;
  name: string;
  extension: string;
  path: string;
}
declare interface UpdateFileUsersProps {
  fileId: string;
  emails: string[];
  path: string;
}
declare interface DeleteFileProps {
  fileId: string;
  bucketFileId: string;
  path: string;
}

declare interface FileUploaderProps {
  ownerId: string;
  accountId: string;
  className?: string;
}

declare interface MobileNavigationProps {
  ownerId: string;
  accountId: string;
  fullName: string;
  avatar: string;
  email: string;
}
declare interface SidebarProps {
  fullName: string;
  avatar: string;
  email: string;
}

declare interface ThumbnailProps {
  type: string;
  extension: string;
  url: string;
  className?: string;
  imageClassName?: string;
}

declare interface ShareInputProps {
  file: FileDocument;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (email: string) => void;
}

declare interface FileOwnerDoc {
  id: string;
  $id: string;
  fullName: string;
  email: string;
  avatar: string;
}

declare interface FileDocument {
  $id: string;
  $createdAt: string; // ISO date string
  $updatedAt: string; // ISO date string

  // Legacy system fields — kept optional so old component
  // destructuring still type-checks; unused after the D1 migration.
  $databaseId?: string;
  $collectionId?: string;
  $permissions?: string[];
  $sequence?: number;

  accountId?: string;
  bucketFileId: string;
  extension: string;
  name: string;
  owner: FileOwnerDoc; // populated owner object (see lib/mappers.toFileDoc)
  ownerId?: string;
  size: number;
  type: "document" | "image" | "video" | "audio" | string;
  url: string;
  users?: string[];
}