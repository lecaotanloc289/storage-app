import Link from "next/link";
import Thumbnail from "./Thumbnail";
import { convertFileSize } from "@/lib/utils";
import FormattedDateTime from "./FormattedDateTime";
import { Models } from "node-appwrite";
import ActionDropdown from "./ActionDropdown";
// FileDocument
const Card = ({ file }: { file: FileDocument }) => {
  const {
    $id,
    $databaseId,
    $collectionId,
    $createdAt,
    $updatedAt,
    $permissions,
    $sequence,
    accountId,
    bucketFileId,
    extension,
    name,
    owner,
    size,
    type,
    url,
    users,
  } = file;
  return (
    <Link href={url} target="_blank" className="file-card">
      <div className="flex justify-between">
        <Thumbnail
          type={type}
          extension={extension}
          url={url}
          className="size-20!"
          imageClassName="size-11!"
        />
        <div className="flex flex-col items-end justify-between">
          <ActionDropdown file={file} />
          <p className="body-1">{convertFileSize(size)}</p>
        </div>
      </div>
      <div className="file-card-details">
        <p className="subtitle-2 line-clamp-1">{name}</p>
        <FormattedDateTime
          date={$createdAt}
          className="body-2 text-light-100"
        />
        <p className="">By: {owner?.fullName}</p>
      </div>
    </Link>
  );
};

export default Card;
