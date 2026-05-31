import 'package:json_annotation/json_annotation.dart';

part 'project_model.g.dart';

@JsonSerializable()
class Project {
  final int id;
  final String name;
  final String description;
  final String status;
  final String startDate;
  final String? endDate;
  final List<String> engineers;
  final int? progress;
  final int totalInspections;
  final int completedInspections;

  const Project({
    required this.id,
    required this.name,
    required this.description,
    required this.status,
    required this.startDate,
    this.endDate,
    required this.engineers,
    this.progress,
    required this.totalInspections,
    required this.completedInspections,
  });

  factory Project.fromJson(Map<String, dynamic> json) => _$ProjectFromJson(json);
  Map<String, dynamic> toJson() => _$ProjectToJson(this);

  Project copyWith({
    int? id,
    String? name,
    String? description,
    String? status,
    String? startDate,
    String? endDate,
    List<String>? engineers,
    int? progress,
    int? totalInspections,
    int? completedInspections,
  }) {
    return Project(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      status: status ?? this.status,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      engineers: engineers ?? this.engineers,
      progress: progress ?? this.progress,
      totalInspections: totalInspections ?? this.totalInspections,
      completedInspections: completedInspections ?? this.completedInspections,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Project &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'Project{id: $id, name: $name, status: $status}';
  }
}
