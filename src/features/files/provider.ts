export type UploadedPart = {
  partNumber: number;
  etag: string;
  size: number;
};

export type SignedProviderRequest = {
  url: string;
  expiresAt: Date;
};

export interface FileStorageProvider {
  signSinglePartUpload(input: {
    key: string;
    contentType: string;
  }): Promise<SignedProviderRequest>;
  createMultipartUpload(input: {
    key: string;
    contentType: string;
  }): Promise<{ providerUploadId: string }>;
  signMultipartPart(input: {
    key: string;
    providerUploadId: string;
    partNumber: number;
  }): Promise<SignedProviderRequest>;
  listMultipartParts(input: {
    key: string;
    providerUploadId: string;
  }): Promise<UploadedPart[]>;
  completeMultipartUpload(input: {
    key: string;
    providerUploadId: string;
    parts: UploadedPart[];
  }): Promise<void>;
  abortMultipartUpload(input: {
    key: string;
    providerUploadId: string;
  }): Promise<void>;
  headObject(key: string): Promise<{
    byteSize: number;
    contentType: string | null;
  }>;
  signDownload(input: {
    key: string;
    filename: string;
    disposition?: "attachment" | "inline";
  }): Promise<SignedProviderRequest>;
}
