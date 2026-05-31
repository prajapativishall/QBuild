import 'dart:html' as html show Blob, FileReader;
import 'dart:typed_data';
import 'package:image_picker/image_picker.dart';

/// Web-specific file reading utilities
class WebFileReader {
  /// Read bytes from a blob file for Flutter Web
  static Future<Uint8List> readBlobBytes(XFile photoFile) async {
    try {
      // Convert XFile to blob and read using FileReader
      final blob = html.Blob([await photoFile.readAsBytes()]);
      final reader = html.FileReader();
      reader.readAsArrayBuffer(blob);
      await reader.onLoad.first;
      return reader.result as Uint8List;
    } catch (e) {
      throw Exception('Failed to read blob file: $e');
    }
  }
}
