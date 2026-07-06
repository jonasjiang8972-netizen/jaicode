package upload

import (
	"bytes"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"testing"
)

func createMinimalPNG() []byte {
	return []byte{
		0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
		0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
		0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41,
		0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
		0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
		0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
		0x42, 0x60, 0x82,
	}
}

func createMultipartBodyWithContentType(content []byte, filename, contentType string) (*bytes.Buffer, string) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	h := make(map[string][]string)
	h["Content-Disposition"] = []string{`form-data; name="image"; filename="` + filename + `"`}
	h["Content-Type"] = []string{contentType}
	part, _ := writer.CreatePart(h)
	part.Write(content)
	writer.Close()
	return body, writer.FormDataContentType()
}

func createMultipartFileFromBody(body *bytes.Buffer, contentType string) (multipart.File, *multipart.FileHeader, error) {
	req := httptest.NewRequest("POST", "/upload", body)
	req.Header.Set("Content-Type", contentType)
	return req.FormFile("image")
}

func createMultipartFile(content []byte, filename string) (multipart.File, *multipart.FileHeader) {
	body, contentType := createMultipartBodyWithContentType(content, filename, "image/png")
	file, header, _ := createMultipartFileFromBody(body, contentType)
	return file, header
}

func TestHandlerHandleUpload(t *testing.T) {
	tmpDir, _ := os.MkdirTemp("", "upload-test-*")
	defer os.RemoveAll(tmpDir)

	handler := NewHandler(tmpDir, 2)
	body, contentType := createMultipartBodyWithContentType(createMinimalPNG(), "test.png", "image/png")
	file, header, err := createMultipartFileFromBody(body, contentType)
	if err != nil {
		t.Fatal(err)
	}

	uploaded, err := handler.HandleUpload(file, header)
	if err != nil {
		t.Fatalf("Upload failed: %s", err)
	}
	if uploaded.ID == "" {
		t.Fatal("Expected non-empty upload ID")
	}
	if uploaded.Size != int64(len(createMinimalPNG())) {
		t.Fatalf("Size mismatch: got %d, want %d", uploaded.Size, len(createMinimalPNG()))
	}
}

func TestHandlerRejectsOversizedFile(t *testing.T) {
	tmpDir, _ := os.MkdirTemp("", "upload-test-*")
	defer os.RemoveAll(tmpDir)

	handler := NewHandler(tmpDir, 1)
	largeData := make([]byte, 2*1024*1024)
	body, contentType := createMultipartBodyWithContentType(largeData, "large.png", "image/png")
	file, header, err := createMultipartFileFromBody(body, contentType)
	if err != nil {
		t.Fatal(err)
	}
	_, err = handler.HandleUpload(file, header)
	if err == nil {
		t.Fatal("Expected error for oversized file")
	}
}

func TestHandlerRejectsInvalidMIME(t *testing.T) {
	tmpDir, _ := os.MkdirTemp("", "upload-test-*")
	defer os.RemoveAll(tmpDir)

	handler := NewHandler(tmpDir, 2)
	body, contentType := createMultipartBodyWithContentType([]byte("malicious"), "test.exe", "application/octet-stream")
	file, header, err := createMultipartFileFromBody(body, contentType)
	if err != nil {
		t.Fatal(err)
	}
	_, err = handler.HandleUpload(file, header)
	if err == nil {
		t.Fatal("Expected error for invalid MIME type")
	}
}

func TestHandlerMagicBytesValidation(t *testing.T) {
	tmpDir, _ := os.MkdirTemp("", "upload-test-*")
	defer os.RemoveAll(tmpDir)

	handler := NewHandler(tmpDir, 2)
	body, contentType := createMultipartBodyWithContentType([]byte("this is not a png file"), "fake.png", "image/png")
	file, header, err := createMultipartFileFromBody(body, contentType)
	if err != nil {
		t.Fatal(err)
	}
	_, err = handler.HandleUpload(file, header)
	if err == nil {
		t.Fatal("Expected error for invalid magic bytes")
	}
}

func TestHandlerReadAsBase64(t *testing.T) {
	tmpDir, _ := os.MkdirTemp("", "upload-test-*")
	defer os.RemoveAll(tmpDir)

	handler := NewHandler(tmpDir, 2)
	body, contentType := createMultipartBodyWithContentType(createMinimalPNG(), "test.png", "image/png")
	file, header, err := createMultipartFileFromBody(body, contentType)
	if err != nil {
		t.Fatal(err)
	}
	uploaded, err := handler.HandleUpload(file, header)
	if err != nil {
		t.Fatalf("Upload failed: %s", err)
	}

	encoded, mimeType, err := handler.ReadAsBase64(uploaded.ID)
	if err != nil {
		t.Fatal(err)
	}
	if encoded == "" {
		t.Fatal("Expected non-empty base64 encoding")
	}
	if mimeType != "image/png" {
		t.Fatalf("Expected mime type image/png, got %s", mimeType)
	}
}

func TestHandlerCleanup(t *testing.T) {
	tmpDir, _ := os.MkdirTemp("", "upload-test-*")
	defer os.RemoveAll(tmpDir)

	handler := NewHandler(tmpDir, 2)
	body, contentType := createMultipartBodyWithContentType(createMinimalPNG(), "test.png", "image/png")
	file, header, err := createMultipartFileFromBody(body, contentType)
	if err != nil {
		t.Fatal(err)
	}
	uploaded, err := handler.HandleUpload(file, header)
	if err != nil {
		t.Fatalf("Upload failed: %s", err)
	}

	if _, err := os.Stat(uploaded.Path); err != nil {
		t.Fatal("Uploaded file should exist on disk")
	}

	handler.Cleanup(0)

	if _, err := os.Stat(uploaded.Path); !os.IsNotExist(err) {
		t.Fatal("File should be removed after cleanup")
	}
}
