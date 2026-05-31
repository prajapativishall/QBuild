// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sub_domain_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SubDomain _$SubDomainFromJson(Map<String, dynamic> json) => SubDomain(
  id: (json['id'] as num).toInt(),
  name: json['name'] as String,
  description: json['description'] as String,
  domainId: (json['domainId'] as num).toInt(),
  domainName: json['domainName'] as String,
  weightage: (json['weightage'] as num).toInt(),
  queries: (json['queries'] as num).toInt(),
  isActive: json['isActive'] as bool,
  order: (json['order'] as num).toInt(),
);

Map<String, dynamic> _$SubDomainToJson(SubDomain instance) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'description': instance.description,
  'domainId': instance.domainId,
  'domainName': instance.domainName,
  'weightage': instance.weightage,
  'queries': instance.queries,
  'isActive': instance.isActive,
  'order': instance.order,
};

Domain _$DomainFromJson(Map<String, dynamic> json) => Domain(
  id: (json['id'] as num).toInt(),
  name: json['name'] as String,
  description: json['description'] as String,
  order: (json['order'] as num).toInt(),
  subDomains: (json['subDomains'] as List<dynamic>)
      .map((e) => SubDomain.fromJson(e as Map<String, dynamic>))
      .toList(),
  isActive: json['isActive'] as bool,
);

Map<String, dynamic> _$DomainToJson(Domain instance) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'description': instance.description,
  'order': instance.order,
  'subDomains': instance.subDomains,
  'isActive': instance.isActive,
};
