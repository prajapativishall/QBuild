// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'project_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Project _$ProjectFromJson(Map<String, dynamic> json) => Project(
  id: (json['id'] as num).toInt(),
  name: json['name'] as String,
  description: json['description'] as String,
  status: json['status'] as String,
  startDate: json['startDate'] as String,
  endDate: json['endDate'] as String?,
  engineers: (json['engineers'] as List<dynamic>)
      .map((e) => e as String)
      .toList(),
  progress: (json['progress'] as num?)?.toInt(),
  totalInspections: (json['totalInspections'] as num).toInt(),
  completedInspections: (json['completedInspections'] as num).toInt(),
);

Map<String, dynamic> _$ProjectToJson(Project instance) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'description': instance.description,
  'status': instance.status,
  'startDate': instance.startDate,
  'endDate': instance.endDate,
  'engineers': instance.engineers,
  if (instance.progress case final value?) 'progress': value,
  'totalInspections': instance.totalInspections,
  'completedInspections': instance.completedInspections,
};
